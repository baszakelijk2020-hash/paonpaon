/**
 * Preferred Tailoring partner network (SRV-101..103 / PHASE 12.3).
 *
 * Deliberate reuse, stated up front because the alternative is a second
 * truth: this module does NOT define bookings, service plans or cost
 * records. `service_bookings`, `service_plans` and `service_cost_records`
 * (2026-07-30, concierge) already exist and stay canonical. What is
 * genuinely missing — and what this adds — is the *partner*: who the work
 * goes out to, what they are capable of, what they promised, what they
 * charged, and what came back.
 *
 * `chain_of_custody_events` is likewise left alone. It is tightly coupled
 * to `alteration_work_orders` by a status-machine trigger, and widening it
 * to cover dry-cleaning a wardrobe item with no work order would mean
 * rewriting a proven flow for no benefit to it. Partner custody is
 * therefore a separate table for a genuinely separate fact — a garment
 * going to an external partner outside an alteration — not a second record
 * of the same one. See `PARTNER_CUSTODY_SPLIT_NOTE`.
 */

import type {
  CustomerId,
  RetailerId,
  ServiceBookingId,
  ServiceCostRecordId,
  ServicePartnerCustodyEventId,
  ServicePartnerEngagementId,
  ServicePartnerId,
  ServicePartnerInvoiceId,
  ServicePartnerInvoiceLineId,
  StaffId,
  WardrobeItemId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const PARTNER_CUSTODY_SPLIT_NOTE =
  "Alteration custody stays in chain_of_custody_events. Partner custody " +
  "covers garments sent out with no alteration work order. One fact, one " +
  "table each — never the same garment movement in both.";

export const PARTNER_CAPABILITIES = [
  "alteration",
  "dry_cleaning",
  "shoe_repair",
  "leather_care",
  "invisible_mending",
  "storage",
] as const;
export type PartnerCapability = (typeof PARTNER_CAPABILITIES)[number];

export interface ServicePartner {
  readonly partnerId: string;
  readonly displayName: string;
  /** Partners are per location: a courier round-trip to another city is a
   * different service with different economics. */
  readonly branchId?: string;
  readonly capabilities: readonly PartnerCapability[];
  readonly turnaroundDays: number;
  readonly active: boolean;
}

/** Persisted partner row — a superset of `ServicePartner`, so it can be
 * passed anywhere the pure functions above expect one. */
export interface ServicePartnerRecord extends ServicePartner, Timestamps {
  readonly id: ServicePartnerId;
  readonly retailerId: RetailerId;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
}

export type PartnerSelection =
  | {
      readonly ok: true;
      readonly partnerId: string;
      readonly rationale: string;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "no_partner_with_capability"
        | "no_partner_at_branch"
        | "no_partner_meets_deadline";
    };

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor(
    (Date.parse(toIso) - Date.parse(fromIso)) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Chooses a partner and says why. Returns distinct refusal reasons rather
 * than one "no partner available": "nobody here does leather" and "the one
 * who does cannot make Friday" lead a manager to completely different
 * actions.
 */
export function selectPartner(args: {
  readonly partners: readonly ServicePartner[];
  readonly capability: PartnerCapability;
  readonly branchId?: string;
  readonly requestedOn: string;
  readonly neededBy?: string;
}): PartnerSelection {
  const active = args.partners.filter((partner) => partner.active);
  const capable = active.filter((partner) =>
    partner.capabilities.includes(args.capability),
  );
  if (capable.length === 0) {
    return { ok: false, reason: "no_partner_with_capability" };
  }
  const atBranch = args.branchId
    ? capable.filter(
        (partner) =>
          partner.branchId === undefined || partner.branchId === args.branchId,
      )
    : capable;
  if (atBranch.length === 0) {
    return { ok: false, reason: "no_partner_at_branch" };
  }
  const sorted = [...atBranch].sort(
    (a, b) => a.turnaroundDays - b.turnaroundDays,
  );
  if (args.neededBy) {
    const available = daysBetween(args.requestedOn, args.neededBy);
    const inTime = sorted.filter(
      (partner) => partner.turnaroundDays <= available,
    );
    if (inTime.length === 0) {
      return { ok: false, reason: "no_partner_meets_deadline" };
    }
    const chosen = inTime[0]!;
    return {
      ok: true,
      partnerId: chosen.partnerId,
      rationale: `${chosen.displayName}: ${chosen.turnaroundDays}d turnaround, ${available}d available`,
    };
  }
  const chosen = sorted[0]!;
  return {
    ok: true,
    partnerId: chosen.partnerId,
    rationale: `${chosen.displayName}: fastest ${args.capability} turnaround at ${chosen.turnaroundDays}d`,
  };
}

export const PARTNER_CUSTODY_STATES = [
  "with_retailer",
  "in_transit_to_partner",
  "with_partner",
  "in_transit_to_retailer",
  "returned_to_retailer",
  "released_to_customer",
] as const;
export type PartnerCustodyState = (typeof PARTNER_CUSTODY_STATES)[number];

/** A garment sent to a partner for work outside any alteration work order —
 * see `PARTNER_CUSTODY_SPLIT_NOTE` for why this is not `chain_of_custody_events`. */
export interface ServicePartnerEngagement extends Timestamps {
  readonly id: ServicePartnerEngagementId;
  readonly retailerId: RetailerId;
  readonly partnerId: ServicePartnerId;
  readonly customerId: CustomerId;
  readonly wardrobeItemId: WardrobeItemId;
  readonly bookingId?: ServiceBookingId;
  readonly jobReference: string;
  readonly capability: PartnerCapability;
  readonly instructions: string;
  readonly sentOn?: string;
  readonly dueOn: string;
  readonly returnedOn?: string;
  readonly custodyState: PartnerCustodyState;
}

export interface PartnerCustodyEvent {
  readonly id: ServicePartnerCustodyEventId;
  readonly retailerId: RetailerId;
  readonly engagementId: ServicePartnerEngagementId;
  readonly fromState: PartnerCustodyState;
  readonly toState: PartnerCustodyState;
  readonly conditionNote?: string;
  readonly actorStaffId?: StaffId;
  readonly occurredAt: string;
}

const CUSTODY_GRAPH: Readonly<
  Record<PartnerCustodyState, readonly PartnerCustodyState[]>
> = {
  with_retailer: ["in_transit_to_partner", "released_to_customer"],
  in_transit_to_partner: ["with_partner", "with_retailer"],
  with_partner: ["in_transit_to_retailer"],
  in_transit_to_retailer: ["returned_to_retailer", "with_partner"],
  returned_to_retailer: ["released_to_customer", "in_transit_to_partner"],
  released_to_customer: [],
};

export type CustodyCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "transition_not_allowed"
        | "release_requires_return"
        | "condition_note_required";
    };

/**
 * A garment can never go from "with partner" straight to "released to
 * customer". Somebody at the retailer has to physically have it back and
 * say so — that missing step is how a garment is marked collected while
 * still sitting on a rail across town.
 */
export function checkCustodyTransition(args: {
  readonly from: PartnerCustodyState;
  readonly to: PartnerCustodyState;
  readonly conditionNote?: string;
}): CustodyCheck {
  if (!CUSTODY_GRAPH[args.from].includes(args.to)) {
    if (args.to === "released_to_customer") {
      return { ok: false, reason: "release_requires_return" };
    }
    return { ok: false, reason: "transition_not_allowed" };
  }
  if (
    args.to === "returned_to_retailer" &&
    (args.conditionNote ?? "").trim().length === 0
  ) {
    // The moment a garment comes back is the only moment damage can be
    // attributed. An unrecorded return makes every later dispute a
    // stalemate.
    return { ok: false, reason: "condition_note_required" };
  }
  return { ok: true };
}

/**
 * What a partner is allowed to see about a job. A whitelist, like the
 * outworker ticket in 12.2 — a redaction pass fails open when someone adds
 * a field, this fails closed.
 */
export interface PartnerJobView {
  readonly jobReference: string;
  readonly capability: PartnerCapability;
  readonly garmentDescription: string;
  readonly instructions: string;
  readonly dueOn: string;
}

export function buildPartnerJobView(args: {
  readonly jobReference: string;
  readonly capability: PartnerCapability;
  readonly garmentDescription: string;
  readonly instructions: string;
  readonly dueOn: string;
  readonly customerFullName: string;
  readonly customerAddress?: string;
}): PartnerJobView {
  // customerFullName and customerAddress are accepted so callers can pass
  // the whole record without thinking, and are deliberately dropped here.
  void args.customerFullName;
  void args.customerAddress;
  return {
    jobReference: args.jobReference,
    capability: args.capability,
    garmentDescription: args.garmentDescription,
    instructions: args.instructions,
    dueOn: args.dueOn,
  };
}

export interface SlaAssessment {
  readonly breached: boolean;
  readonly daysLate: number;
  readonly promisedOn: string;
}

export function assessPartnerSla(args: {
  readonly sentOn: string;
  readonly turnaroundDays: number;
  readonly returnedOn?: string;
  readonly asOf: string;
}): SlaAssessment {
  const promisedMs =
    Date.parse(args.sentOn) + args.turnaroundDays * 24 * 60 * 60 * 1000;
  const promisedOn = new Date(promisedMs).toISOString().slice(0, 10);
  const reference = args.returnedOn ?? args.asOf;
  const daysLate = Math.floor(
    (Date.parse(reference) - promisedMs) / (1000 * 60 * 60 * 24),
  );
  return {
    breached: daysLate > 0,
    daysLate: Math.max(daysLate, 0),
    promisedOn,
  };
}

export interface InvoiceLine {
  readonly jobReference: string;
  readonly amountMinorUnits: number;
}

export interface RecordedCost {
  readonly jobReference: string;
  readonly amountMinorUnits: number;
}

export const PARTNER_INVOICE_STATES = [
  "submitted",
  "reconciled",
  "approved",
  "disputed",
] as const;
export type PartnerInvoiceState = (typeof PARTNER_INVOICE_STATES)[number];

export interface ServicePartnerInvoice extends Timestamps {
  readonly id: ServicePartnerInvoiceId;
  readonly retailerId: RetailerId;
  readonly partnerId: ServicePartnerId;
  readonly partnerInvoiceReference: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: string;
  readonly submittedByStaffId?: StaffId;
  readonly state: PartnerInvoiceState;
  readonly approvedByStaffId?: StaffId;
  readonly approvedAt?: string;
  readonly reconciliation: InvoiceReconciliation | Record<string, never>;
}

export interface ServicePartnerInvoiceLine {
  readonly id: ServicePartnerInvoiceLineId;
  readonly retailerId: RetailerId;
  readonly invoiceId: ServicePartnerInvoiceId;
  readonly jobReference: string;
  readonly amountMinorUnits: number;
  readonly matchedCostRecordId?: ServiceCostRecordId;
}

export interface InvoiceReconciliation {
  readonly matched: readonly string[];
  /** Invoiced but no cost was ever recorded against that job. */
  readonly unmatchedInvoiceLines: readonly string[];
  /** A cost we expected to be invoiced and was not. */
  readonly uninvoicedCosts: readonly string[];
  readonly amountVariances: readonly {
    readonly jobReference: string;
    readonly recordedMinorUnits: number;
    readonly invoicedMinorUnits: number;
    readonly varianceMinorUnits: number;
  }[];
  readonly reconciled: boolean;
}

/**
 * Reconciles a partner invoice against `service_cost_records` — the costs
 * the retailer already recorded operationally. This is a comparison, not a
 * second cost truth: nothing here writes an amount.
 *
 * `reconciled` is false whenever anything at all does not line up. An
 * invoice that "mostly matches" is an invoice nobody has actually checked.
 */
export function reconcilePartnerInvoice(args: {
  readonly invoiceLines: readonly InvoiceLine[];
  readonly recordedCosts: readonly RecordedCost[];
}): InvoiceReconciliation {
  const recordedByRef = new Map(
    args.recordedCosts.map((cost) => [cost.jobReference, cost]),
  );
  const invoicedRefs = new Set(
    args.invoiceLines.map((line) => line.jobReference),
  );

  const matched: string[] = [];
  const unmatchedInvoiceLines: string[] = [];
  const amountVariances: InvoiceReconciliation["amountVariances"][number][] =
    [];

  for (const line of args.invoiceLines) {
    const recorded = recordedByRef.get(line.jobReference);
    if (!recorded) {
      unmatchedInvoiceLines.push(line.jobReference);
      continue;
    }
    matched.push(line.jobReference);
    if (recorded.amountMinorUnits !== line.amountMinorUnits) {
      amountVariances.push({
        jobReference: line.jobReference,
        recordedMinorUnits: recorded.amountMinorUnits,
        invoicedMinorUnits: line.amountMinorUnits,
        varianceMinorUnits: line.amountMinorUnits - recorded.amountMinorUnits,
      });
    }
  }

  const uninvoicedCosts = args.recordedCosts
    .filter((cost) => !invoicedRefs.has(cost.jobReference))
    .map((cost) => cost.jobReference);

  return {
    matched: matched.sort(),
    unmatchedInvoiceLines: unmatchedInvoiceLines.sort(),
    uninvoicedCosts: uninvoicedCosts.sort(),
    amountVariances,
    reconciled:
      unmatchedInvoiceLines.length === 0 &&
      uninvoicedCosts.length === 0 &&
      amountVariances.length === 0,
  };
}

export type InvoiceApprovalCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        "not_reconciled" | "self_approval_not_allowed" | "payout_not_designed";
    };

/**
 * Approving an invoice means "this is correct and owed". It explicitly
 * does NOT pay it: this item's non-goal is "no partner payout without
 * approved money design", and ADR-062 has not made that decision. Passing
 * `initiatePayout` is refused rather than ignored, so a caller cannot
 * believe money moved.
 */
export function checkInvoiceApproval(args: {
  readonly reconciliation: InvoiceReconciliation;
  readonly submittedByStaffId: string;
  readonly approverStaffId: string;
  readonly initiatePayout?: boolean;
}): InvoiceApprovalCheck {
  if (!args.reconciliation.reconciled) {
    return { ok: false, reason: "not_reconciled" };
  }
  if (args.submittedByStaffId === args.approverStaffId) {
    return { ok: false, reason: "self_approval_not_allowed" };
  }
  if (args.initiatePayout) {
    return { ok: false, reason: "payout_not_designed" };
  }
  return { ok: true };
}
