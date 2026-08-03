"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  InternalCommunityRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface RecoveryActionState {
  formError?: string;
  notice?: string;
}

/**
 * Ceiling for a single request. No per-retailer configuration exists for
 * this yet (ADR-062 has not decided a payout design at all, let alone a
 * budget policy) — this is a conservative built-in cap, not a business
 * decision baked in permanently. A configurable per-retailer cap is future
 * scope; see docs/PHASE.md 11.4.
 */
const PER_REQUEST_CAP_MINOR_UNITS = 25_000;

const REQUEST_REJECTION_MESSAGES: Record<string, string> = {
  amount_not_positive: "Enter an amount greater than zero.",
  amount_above_cap: "That's above the per-request cap of €250.",
  reason_required: "Say what happened — at least 10 characters.",
  no_service_context:
    "Attach this to a client or an order — recovery is recovery for someone.",
};

const DECISION_REJECTION_MESSAGES: Record<string, string> = {
  not_awaiting_approval: "This request has already been decided.",
  self_approval_not_allowed: "You can't approve your own request.",
};

export async function requestBudget(
  _previous: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  const session = await requireModuleSession("retail_operations", "mutate");
  const supabase = await getSupabaseServerClient();
  const requester = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!requester) {
    return { formError: "Your staff record could not be found." };
  }

  const amountMinorUnits = Math.round(
    Number(formData.get("amount") ?? 0) * 100,
  );
  const reason = String(formData.get("reason") ?? "").trim();
  const customerId =
    (formData.get("customerId") as string | null)?.trim() || undefined;
  const orderId =
    (formData.get("orderId") as string | null)?.trim() || undefined;

  const result = await new InternalCommunityRepository(
    supabase,
  ).requestServiceRecoveryBudget({
    retailerId: session.retailerId,
    requestedByStaffId: requester.id,
    amountMinorUnits,
    perRequestCapMinorUnits: PER_REQUEST_CAP_MINOR_UNITS,
    reason,
    ...(customerId ? { customerId } : {}),
    ...(orderId ? { orderId } : {}),
  });
  if (!result.ok) {
    return {
      formError:
        REQUEST_REJECTION_MESSAGES[result.reason] ??
        "That request could not be submitted.",
    };
  }

  revalidatePath("/staff/service-recovery");
  return { notice: "Requested. A manager will review it." };
}

export async function decideBudget(
  _previous: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  const session = await requireModuleSession("retail_operations", "mutate");
  requireRetailerRole(session.retailerRole, "manager");

  const supabase = await getSupabaseServerClient();
  const approver = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!approver) {
    return { formError: "Your staff record could not be found." };
  }

  const requestId = String(formData.get("requestId") ?? "").trim();
  const approve = String(formData.get("decision") ?? "") === "approve";
  const decisionNote = String(formData.get("decisionNote") ?? "").trim();

  const result = await new InternalCommunityRepository(
    supabase,
  ).decideServiceRecoveryBudget({
    retailerId: session.retailerId,
    requestId,
    approverStaffId: approver.id,
    approve,
    ...(decisionNote ? { decisionNote } : {}),
  });
  if (!result.ok) {
    return {
      formError:
        DECISION_REJECTION_MESSAGES[result.reason] ??
        "Could not record that decision.",
    };
  }

  revalidatePath("/staff/service-recovery");
  return { notice: approve ? "Approved." : "Declined." };
}
