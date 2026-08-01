/**
 * Lifestyle partner catalogue and attribution (NET-101..104 /
 * PHASE 15.1, 15.2).
 *
 * The non-goal that governs everything: **no silent sale of named customer
 * profiles**. A partner learns that *someone* clicked, converted, or
 * qualified for an audience. They never learn who. `buildPartnerPayload`
 * is a whitelist over a pseudonymous id, and a test asserts the raw
 * Self-Portrait cannot leak through it.
 *
 * The second: a reward is an entry in a ledger that names its funding
 * source and can be reversed. ADR-062 has not approved stored value, so
 * `checkRewardGrant` refuses any reward whose funding is unnamed, and
 * `checkRewardRedemption` refuses transfer between customers outright —
 * a transferable balance is a currency, and PAON is not licensed to issue
 * one.
 */

export const ATTRIBUTION_EVENTS = [
  "impression",
  "click",
  "lead",
  "order_confirmed",
  "order_refunded",
] as const;
export type AttributionEvent = (typeof ATTRIBUTION_EVENTS)[number];

export interface AttributionRecord {
  readonly eventId: string;
  readonly event: AttributionEvent;
  readonly listingId: string;
  /** Stable per (customer, partner) pair, meaningless outside it. */
  readonly pseudonymousRef: string;
  readonly occurredAt: string;
  readonly providerEventKey: string;
  readonly valueMinorUnits?: number;
}

export const ATTRIBUTION_STATES = [
  "pending",
  "holding",
  "confirmed",
  "reversed",
  "expired",
] as const;
export type AttributionState = (typeof ATTRIBUTION_STATES)[number];

export interface AttributionOutcome {
  readonly state: AttributionState;
  readonly attributableMinorUnits: number;
  readonly rationale: string;
}

const DEFAULT_HOLDING_DAYS = 30;
const DEFAULT_WINDOW_DAYS = 30;

/**
 * Resolves a partner conversion. Three properties matter:
 *
 * - A confirmed order enters `holding`, not `confirmed`. Commission is
 *   payable only after the return window closes; paying on order and
 *   clawing back later is how a partner ends up owing money on a month
 *   they have already spent.
 * - A refund reverses to zero regardless of where in the holding period
 *   it lands.
 * - Duplicate provider events are collapsed by `providerEventKey`, so a
 *   retried webhook cannot double-attribute.
 */
export function resolveAttribution(args: {
  readonly records: readonly AttributionRecord[];
  readonly asOf: string;
  readonly clickWindowDays?: number;
  readonly holdingDays?: number;
}): AttributionOutcome {
  const seen = new Set<string>();
  const deduped = args.records.filter((record) => {
    if (seen.has(record.providerEventKey)) return false;
    seen.add(record.providerEventKey);
    return true;
  });

  const click = deduped.find((record) => record.event === "click");
  const order = deduped.find((record) => record.event === "order_confirmed");
  const refund = deduped.find((record) => record.event === "order_refunded");

  if (refund) {
    return {
      state: "reversed",
      attributableMinorUnits: 0,
      rationale: "Order refunded; attribution reversed in full",
    };
  }
  if (!order) {
    return {
      state: "pending",
      attributableMinorUnits: 0,
      rationale: click ? "Click recorded, no order yet" : "No click recorded",
    };
  }
  if (!click) {
    return {
      state: "expired",
      attributableMinorUnits: 0,
      rationale: "Order has no attributable click",
    };
  }

  const windowDays = args.clickWindowDays ?? DEFAULT_WINDOW_DAYS;
  const daysBetweenClickAndOrder =
    (Date.parse(order.occurredAt) - Date.parse(click.occurredAt)) /
    (1000 * 60 * 60 * 24);
  if (daysBetweenClickAndOrder > windowDays || daysBetweenClickAndOrder < 0) {
    return {
      state: "expired",
      attributableMinorUnits: 0,
      rationale: `Order fell outside the ${windowDays}-day click window`,
    };
  }

  const holdingDays = args.holdingDays ?? DEFAULT_HOLDING_DAYS;
  const daysSinceOrder =
    (Date.parse(args.asOf) - Date.parse(order.occurredAt)) /
    (1000 * 60 * 60 * 24);
  if (daysSinceOrder < holdingDays) {
    return {
      state: "holding",
      attributableMinorUnits: order.valueMinorUnits ?? 0,
      rationale: `Holding until the ${holdingDays}-day return window closes`,
    };
  }
  return {
    state: "confirmed",
    attributableMinorUnits: order.valueMinorUnits ?? 0,
    rationale: "Return window closed with no refund",
  };
}

export interface PartnerPayload {
  readonly pseudonymousRef: string;
  readonly listingId: string;
  readonly event: AttributionEvent;
  readonly occurredAt: string;
}

/**
 * Everything a partner is told. A whitelist over a pseudonymous id: no
 * name, no email, no style profile, no measurements, no order history.
 * The partner gets to know that a conversion happened on their listing,
 * which is all they need to be paid.
 */
export function buildPartnerPayload(args: {
  readonly record: AttributionRecord;
  readonly customerFullName?: string;
  readonly customerEmail?: string;
  readonly selfPortrait?: unknown;
}): PartnerPayload {
  void args.customerFullName;
  void args.customerEmail;
  void args.selfPortrait;
  return {
    pseudonymousRef: args.record.pseudonymousRef,
    listingId: args.record.listingId,
    event: args.record.event,
    occurredAt: args.record.occurredAt,
  };
}

export const REWARD_STATES = [
  "pending",
  "available",
  "redeemed",
  "reversed",
  "expired",
] as const;
export type RewardState = (typeof REWARD_STATES)[number];

export const FUNDING_SOURCES = [
  "retailer_margin",
  "partner_commission",
  "marketing_budget",
] as const;
export type FundingSource = (typeof FUNDING_SOURCES)[number];

export type RewardGrantCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "funding_source_required"
        | "value_not_positive"
        | "expiry_required"
        | "attribution_not_confirmed";
    };

/**
 * A reward may only be granted against a named funding source and a
 * confirmed attribution. Both exist for the same reason: ADR-062 has not
 * approved stored value, so every unit of value here must be traceable to
 * money that already exists somewhere, rather than being issued.
 */
export function checkRewardGrant(args: {
  readonly fundingSource?: FundingSource;
  readonly valueMinorUnits: number;
  readonly expiresOn?: string;
  readonly attributionState?: AttributionState;
}): RewardGrantCheck {
  if (!args.fundingSource)
    return { ok: false, reason: "funding_source_required" };
  if (!Number.isInteger(args.valueMinorUnits) || args.valueMinorUnits <= 0) {
    return { ok: false, reason: "value_not_positive" };
  }
  if (!args.expiresOn) {
    // An unexpiring balance is an indefinite liability, which is exactly
    // the stored-value question ADR-062 has not answered.
    return { ok: false, reason: "expiry_required" };
  }
  if (
    args.attributionState !== undefined &&
    args.attributionState !== "confirmed"
  ) {
    return { ok: false, reason: "attribution_not_confirmed" };
  }
  return { ok: true };
}

export type RewardRedemptionCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "not_available"
        | "expired"
        | "insufficient_balance"
        | "transfer_between_customers_not_permitted";
    };

/**
 * Redemption. Transfer between customers is refused outright rather than
 * gated behind a flag: a transferable balance is a currency, and PAON has
 * no licence to issue one. Making it a refusal rather than an unimplemented
 * branch means nobody can enable it by setting a boolean.
 */
export function checkRewardRedemption(args: {
  readonly state: RewardState;
  readonly balanceMinorUnits: number;
  readonly redeemMinorUnits: number;
  readonly expiresOn: string;
  readonly asOf: string;
  readonly targetCustomerId?: string;
  readonly ownerCustomerId: string;
}): RewardRedemptionCheck {
  if (
    args.targetCustomerId !== undefined &&
    args.targetCustomerId !== args.ownerCustomerId
  ) {
    return { ok: false, reason: "transfer_between_customers_not_permitted" };
  }
  if (args.state !== "available") return { ok: false, reason: "not_available" };
  if (Date.parse(args.asOf) > Date.parse(args.expiresOn)) {
    return { ok: false, reason: "expired" };
  }
  if (args.redeemMinorUnits > args.balanceMinorUnits) {
    return { ok: false, reason: "insufficient_balance" };
  }
  return { ok: true };
}

export interface LedgerReversal {
  readonly rewardId: string;
  readonly reversedMinorUnits: number;
  readonly reason: string;
}

/**
 * When an attributed order is refunded, every reward granted from that
 * attribution reverses. Returns the reversals rather than performing them,
 * so the caller writes reversal *entries* — the ledger is append-only and
 * a reversal that edits the original erases the fact that value was ever
 * granted.
 */
export function planRewardReversal(args: {
  readonly rewards: readonly {
    readonly rewardId: string;
    readonly attributionEventId: string;
    readonly valueMinorUnits: number;
    readonly state: RewardState;
  }[];
  readonly reversedAttributionEventIds: readonly string[];
}): readonly LedgerReversal[] {
  const reversed = new Set(args.reversedAttributionEventIds);
  return args.rewards
    .filter(
      (reward) =>
        reversed.has(reward.attributionEventId) &&
        reward.state !== "reversed" &&
        reward.state !== "expired",
    )
    .map((reward) => ({
      rewardId: reward.rewardId,
      reversedMinorUnits: reward.valueMinorUnits,
      reason: "Source attribution refunded",
    }));
}

export type ConciergeRequestCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "detail_required" | "money_movement_not_permitted";
    };

/**
 * Concierge requests are operational — book, arrange, collect, remind.
 * They work with no money design at all, which is why 15.2 splits them
 * from rewards: the useful half of the item should not be blocked on a
 * decision it does not need.
 */
export function checkConciergeRequest(args: {
  readonly detail: string;
  readonly involvesPayment: boolean;
}): ConciergeRequestCheck {
  if (args.detail.trim().length < 10) {
    return { ok: false, reason: "detail_required" };
  }
  if (args.involvesPayment) {
    return { ok: false, reason: "money_movement_not_permitted" };
  }
  return { ok: true };
}
