"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  LossPreventionRepository,
  RetailerStaffRepository,
  StockLedgerRepository,
} from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface RiskActionState {
  formError?: string;
  notice?: string;
}

/**
 * NOT exported — a "use server" module may export only async functions, and
 * Next.js rejects the whole module at invocation with an opaque digest
 * otherwise, leaving the browser showing nothing at all.
 *
 * Every message says who has to do what next. "independent_approval_required"
 * is not something a person standing in a stockroom can act on.
 */
const REJECTION_MESSAGES: Record<string, string> = {
  independent_approval_required:
    "This write-off needs a manager other than you to approve it.",
  self_approval_not_allowed:
    "You raised this write-off, so you cannot be the one to approve it. Ask a manager who was not involved.",
  approver_lacks_authority:
    "Only a manager can approve a write-off of this size.",
  already_approved: "This has already been approved.",
  flag_not_found: "That approval request could not be found.",
  no_count_session:
    "Open a stock count at this location before writing anything off.",
  recount_outstanding:
    "The difference is large enough to need a recount first. Count it again before writing anything off.",
  reason_required:
    "Say what happened — an unexplained write-off is indistinguishable from shrinkage.",
  adjustment_exceeds_variance:
    "That is more than the count actually found. Adjust by the counted difference or recount.",
  resolution_note_required:
    "Say what you found. A discrepancy closed with no reason cannot be told apart from one that was ignored.",
  not_an_open_discrepancy: "That has already been dealt with.",
};

function message(reason: string): string {
  return REJECTION_MESSAGES[reason] ?? "That could not be recorded.";
}

async function context() {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  return {
    session,
    risk: new LossPreventionRepository(supabase),
    ledger: new StockLedgerRepository(supabase),
    ...(staff?.id ? { staffId: staff.id } : {}),
    isManager: retailerRoleAtLeast(session.retailerRole, "manager"),
  };
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/**
 * Raises a write-off for approval. Deliberately does NOT move stock: the
 * whole control is that a flagged adjustment waits for a second pair of eyes,
 * and applying it first would make this a report rather than a gate.
 */
export async function requestWriteOffApproval(
  _previous: RiskActionState,
  formData: FormData,
): Promise<RiskActionState> {
  const { session, risk, staffId } = await context();
  const locationId = field(formData, "locationId");
  const variantId = field(formData, "variantId");
  const quantity = Number(formData.get("quantity") ?? 0);
  const unitPrice = Math.round(Number(formData.get("unitPrice") ?? 0) * 100);

  if (!staffId) return { formError: "Your staff record could not be found." };
  if (!locationId || !variantId) {
    return { formError: "Choose an item and a location." };
  }
  if (!Number.isInteger(quantity) || quantity >= 0) {
    return { formError: "A write-off is a negative whole number." };
  }
  if (!Number.isInteger(unitPrice) || unitPrice <= 0) {
    return { formError: "Enter what one of these is worth." };
  }

  const assessment = await risk.assess({
    retailerId: session.retailerId,
    variantId,
    unitPriceMinorUnits: unitPrice,
    adjustmentQuantity: quantity,
    withinCountSession: true,
  });

  if (!assessment.requiresIndependentApproval) {
    return {
      notice:
        "This is below the threshold for a second signature. Record it on the stock count instead.",
    };
  }

  await risk.requestApproval({
    retailerId: session.retailerId,
    locationId,
    requestedByStaffId: staffId,
    triggeredRules: assessment.triggered,
  });
  revalidatePath("/inventory/risk");
  return {
    notice: `Sent for approval. ${assessment.rationale}`,
  };
}

/**
 * Approves a write-off and applies it. The ledger entry is written here and
 * nowhere else, so a refused approval cannot leave a half-applied write-off.
 */
export async function approveWriteOff(
  _previous: RiskActionState,
  formData: FormData,
): Promise<RiskActionState> {
  const { session, risk, ledger, staffId, isManager } = await context();
  const flagId = field(formData, "flagId");
  const locationId = field(formData, "locationId");
  const variantId = field(formData, "variantId");
  const reason = field(formData, "reason");
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!staffId) return { formError: "Your staff record could not be found." };
  if (!flagId || !locationId || !variantId) {
    return { formError: "Missing required information." };
  }
  if (!reason) return { formError: message("reason_required") };

  // Who may approve is settled BEFORE anything about stock counts.
  // Telling someone to go and open a count session when they are not
  // permitted to approve at all sends them down a pointless errand and
  // hides the real answer behind an unrelated instruction.
  const flag = await risk.findFlag({
    retailerId: session.retailerId,
    flagId,
  });
  if (!flag) return { formError: message("flag_not_found") };
  if (flag.approved_at !== null) {
    return { formError: message("already_approved") };
  }
  if (flag.requested_by_staff_id === staffId) {
    return { formError: message("self_approval_not_allowed") };
  }
  if (!isManager) {
    return { formError: message("approver_lacks_authority") };
  }

  const session_ = await ledger.findOpenCountSession({
    retailerId: session.retailerId,
    locationId,
  });
  if (!session_) return { formError: message("no_count_session") };

  const approved = await risk.approveAndApply({
    retailerId: session.retailerId,
    flagId,
    approverStaffId: staffId,
    approverIsManager: isManager,
    sessionId: session_.id,
    variantId,
    locationId,
    adjustmentQuantity: quantity,
    reason,
  });
  if (!approved.ok) return { formError: message(approved.reason) };

  revalidatePath("/inventory/risk");
  revalidatePath("/inventory");
  return { notice: "Approved and written off. The stock has moved." };
}

/**
 * Records a sweep's reads and reconciles them into discrepancies a person
 * reads. Writes no ledger entry: a reader that can post a balance is a reader
 * that can write off a jacket somebody is wearing in a fitting room.
 */
export async function recordSweep(
  _previous: RiskActionState,
  formData: FormData,
): Promise<RiskActionState> {
  const { session, risk } = await context();
  const locationId = field(formData, "locationId");
  const zoneKey = field(formData, "zoneKey") || "floor";
  const readsRaw = field(formData, "reads");
  const expectedRaw = field(formData, "expected");

  if (!locationId) return { formError: "Choose a location." };
  if (!readsRaw) {
    return { formError: "Paste the tags the reader saw, one per line." };
  }

  const now = new Date().toISOString();
  const observations = readsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // "EPC-123 0.94" — tag then confidence. A missing confidence is
      // treated as a perfect read, because that is what a reader that does
      // not report one is claiming.
      const [epc, confidence] = line.split(/\s+/);
      return {
        epc: epc ?? line,
        zoneKey,
        observedAt: now,
        readConfidence: confidence ? Number(confidence) : 1,
      };
    })
    .filter((observation) => Number.isFinite(observation.readConfidence));

  if (observations.length === 0) {
    return { formError: "None of those lines looked like a tag read." };
  }

  const sweepId = crypto.randomUUID();
  await risk.recordObservations({
    retailerId: session.retailerId,
    locationId,
    sweepId,
    observations,
  });

  const expectedEpcs = expectedRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const reconciliation = await risk.reconcile({
    retailerId: session.retailerId,
    locationId,
    sweepId,
    zoneKey,
    expectedEpcs,
  });
  await risk.recordDiscrepancies({
    retailerId: session.retailerId,
    sweepId,
    reconciliation,
  });

  revalidatePath("/inventory/risk");
  return {
    notice: `Sweep recorded. ${reconciliation.presentEpcs.length} found, ${reconciliation.unobservedEpcs.length} expected but not seen, ${reconciliation.unexpectedEpcs.length} not expected here. No stock was moved.`,
  };
}

/** Closes a discrepancy with a stated reason. */
export async function resolveDiscrepancy(
  _previous: RiskActionState,
  formData: FormData,
): Promise<RiskActionState> {
  const { session, risk } = await context();
  const discrepancyId = field(formData, "discrepancyId");
  const note = field(formData, "note");

  if (!discrepancyId) return { formError: "Missing required information." };

  const resolved = await risk.resolveDiscrepancy({
    retailerId: session.retailerId,
    discrepancyId,
    resolutionNote: note,
  });
  if (!resolved.ok) return { formError: message(resolved.reason) };

  revalidatePath("/inventory/risk");
  return { notice: "Closed, with your explanation on the record." };
}
