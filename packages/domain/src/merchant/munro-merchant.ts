/**
 * MunroMerchant B2B procurement (MKT-001 / ADR-064 / PHASE 15.3).
 *
 * A **separate bounded context**, and the separation is the point. This is
 * a retailer buying paper bags, hangers and shop fittings from suppliers.
 * It shares no entity with the consumer side: no `Customer`, no `Order`,
 * no wardrobe, no Self-Portrait. The item's non-goal is explicit — "no
 * customer-facing marketplace order reuse" — and the way to honour it is
 * for this module to import nothing from the commerce or customer
 * domains at all. A test asserts that import boundary.
 *
 * The flow is RFQ → quote → purchase order → shipment → issue. Money is
 * deliberately absent: an approved PO is a commitment to buy, not a
 * payment, and ADR-062 has not decided a B2B payment design.
 */

export const MERCHANT_CATEGORIES = [
  "packaging",
  "hangers",
  "fixtures",
  "furniture",
  "signage",
  "consumables",
] as const;
export type MerchantCategory = (typeof MERCHANT_CATEGORIES)[number];

export interface PriceTier {
  readonly minimumQuantity: number;
  readonly unitPriceMinorUnits: number;
}

export interface MerchantListing {
  readonly listingId: string;
  readonly supplierKey: string;
  readonly category: MerchantCategory;
  readonly minimumOrderQuantity: number;
  readonly tiers: readonly PriceTier[];
  readonly customizable: boolean;
  readonly sampleAvailable: boolean;
}

export type PricingResult =
  | {
      readonly ok: true;
      readonly unitPriceMinorUnits: number;
      readonly totalMinorUnits: number;
      readonly appliedTierMinimum: number;
    }
  | {
      readonly ok: false;
      readonly reason: "below_minimum_order_quantity" | "no_applicable_tier";
      readonly minimumOrderQuantity?: number;
    };

/**
 * Resolves a tiered price. Picks the *highest* tier whose minimum the
 * quantity clears, which is the tier that actually applies — sorting
 * ascending and taking the first match would quote the most expensive
 * band to the largest buyer.
 */
export function priceForQuantity(args: {
  readonly listing: MerchantListing;
  readonly quantity: number;
}): PricingResult {
  if (args.quantity < args.listing.minimumOrderQuantity) {
    return {
      ok: false,
      reason: "below_minimum_order_quantity",
      minimumOrderQuantity: args.listing.minimumOrderQuantity,
    };
  }
  const applicable = args.listing.tiers
    .filter((tier) => args.quantity >= tier.minimumQuantity)
    .sort((a, b) => b.minimumQuantity - a.minimumQuantity)[0];
  if (!applicable) return { ok: false, reason: "no_applicable_tier" };
  return {
    ok: true,
    unitPriceMinorUnits: applicable.unitPriceMinorUnits,
    totalMinorUnits: applicable.unitPriceMinorUnits * args.quantity,
    appliedTierMinimum: applicable.minimumQuantity,
  };
}

export const RFQ_STATES = [
  "draft",
  "sent",
  "quoted",
  "accepted",
  "declined",
  "expired",
] as const;
export type RfqState = (typeof RFQ_STATES)[number];

const RFQ_GRAPH: Readonly<Record<RfqState, readonly RfqState[]>> = {
  draft: ["sent"],
  sent: ["quoted", "expired", "declined"],
  quoted: ["accepted", "declined", "expired"],
  accepted: [],
  declined: [],
  expired: [],
};

export type RfqCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "transition_not_allowed"
        | "quote_requires_price"
        | "accept_requires_unexpired_quote"
        | "proof_required_for_customization";
    };

/**
 * RFQ progression. A customised item cannot be accepted without an
 * approved proof: printing 5,000 bags with the wrong logo is not a
 * recoverable mistake, and "we thought you'd seen it" is not a defence.
 */
export function checkRfqTransition(args: {
  readonly from: RfqState;
  readonly to: RfqState;
  readonly quotedUnitPriceMinorUnits?: number;
  readonly quoteExpiresOn?: string;
  readonly asOf?: string;
  readonly customizable: boolean;
  readonly proofApproved?: boolean;
}): RfqCheck {
  if (!RFQ_GRAPH[args.from].includes(args.to)) {
    return { ok: false, reason: "transition_not_allowed" };
  }
  if (args.to === "quoted" && args.quotedUnitPriceMinorUnits === undefined) {
    return { ok: false, reason: "quote_requires_price" };
  }
  if (args.to === "accepted") {
    if (args.customizable && !args.proofApproved) {
      return { ok: false, reason: "proof_required_for_customization" };
    }
    if (
      args.quoteExpiresOn &&
      args.asOf &&
      Date.parse(args.asOf) > Date.parse(args.quoteExpiresOn)
    ) {
      return { ok: false, reason: "accept_requires_unexpired_quote" };
    }
  }
  return { ok: true };
}

export const PURCHASE_ORDER_STATES = [
  "draft",
  "approved",
  "acknowledged",
  "shipped",
  "received",
  "closed",
  "cancelled",
] as const;
export type PurchaseOrderState = (typeof PURCHASE_ORDER_STATES)[number];

export type PurchaseOrderCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "approval_requires_second_person"
        | "over_approval_limit"
        | "payment_not_designed"
        | "cannot_receive_unshipped";
    };

/**
 * Approving a purchase order is a commitment to buy. It requires a second
 * person above a threshold, and it explicitly does not pay: passing
 * `initiatePayment` is refused rather than ignored, for the same reason as
 * the partner invoice in 12.3 — a silently dropped flag lets a caller
 * believe money moved.
 */
export function checkPurchaseOrderApproval(args: {
  readonly raisedByStaffId: string;
  readonly approverStaffId: string;
  readonly totalMinorUnits: number;
  readonly secondApprovalThresholdMinorUnits: number;
  readonly approverLimitMinorUnits: number;
  readonly initiatePayment?: boolean;
}): PurchaseOrderCheck {
  if (args.initiatePayment) {
    return { ok: false, reason: "payment_not_designed" };
  }
  if (
    args.totalMinorUnits >= args.secondApprovalThresholdMinorUnits &&
    args.raisedByStaffId === args.approverStaffId
  ) {
    return { ok: false, reason: "approval_requires_second_person" };
  }
  if (args.totalMinorUnits > args.approverLimitMinorUnits) {
    return { ok: false, reason: "over_approval_limit" };
  }
  return { ok: true };
}

export interface GroupBuyState {
  readonly targetQuantity: number;
  readonly committedQuantity: number;
  readonly closesOn: string;
}

export type GroupBuyResult =
  | { readonly ok: true; readonly reached: boolean; readonly shortfall: number }
  | {
      readonly ok: false;
      readonly reason: "closed" | "commitment_not_positive";
    };

/**
 * Group buy. Reports `reached: false` with the shortfall rather than
 * pretending a near-miss succeeded — a group buy that "nearly" hit its
 * minimum is a group buy the supplier will not honour, and telling
 * participants otherwise creates a promise nobody can keep.
 */
export function evaluateGroupBuy(args: {
  readonly state: GroupBuyState;
  readonly additionalQuantity: number;
  readonly asOf: string;
}): GroupBuyResult {
  if (Date.parse(args.asOf) > Date.parse(args.state.closesOn)) {
    return { ok: false, reason: "closed" };
  }
  if (
    !Number.isInteger(args.additionalQuantity) ||
    args.additionalQuantity <= 0
  ) {
    return { ok: false, reason: "commitment_not_positive" };
  }
  const committed = args.state.committedQuantity + args.additionalQuantity;
  return {
    ok: true,
    reached: committed >= args.state.targetQuantity,
    shortfall: Math.max(args.state.targetQuantity - committed, 0),
  };
}

export const SHIPMENT_ISSUE_KINDS = [
  "short_shipped",
  "damaged",
  "wrong_specification",
  "late",
] as const;
export type ShipmentIssueKind = (typeof SHIPMENT_ISSUE_KINDS)[number];

export type ShipmentIssueCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        "evidence_required" | "quantity_exceeds_shipment" | "not_yet_received";
    };

export function checkShipmentIssue(args: {
  readonly kind: ShipmentIssueKind;
  readonly received: boolean;
  readonly affectedQuantity: number;
  readonly shipmentQuantity: number;
  readonly evidenceRefs: readonly string[];
}): ShipmentIssueCheck {
  if (!args.received && args.kind !== "late") {
    return { ok: false, reason: "not_yet_received" };
  }
  if (args.affectedQuantity > args.shipmentQuantity) {
    return { ok: false, reason: "quantity_exceeds_shipment" };
  }
  if (args.kind !== "late" && args.evidenceRefs.length === 0) {
    // A damage or specification claim with no photo is a claim the
    // supplier will reject, and raising it anyway wastes both sides' time.
    return { ok: false, reason: "evidence_required" };
  }
  return { ok: true };
}
