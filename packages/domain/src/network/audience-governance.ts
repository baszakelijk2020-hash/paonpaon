/**
 * Audience Studio and governed release (NET-105 / NET-106 /
 * PHASE 15.4, 15.5).
 *
 * Two rules carry this whole area, and both are about *time*:
 *
 * 1. Activation pins a cohort version. A later rule edit must not be able
 *    to restate a past forecast or a past payable. `checkActivation`
 *    refuses to activate without a version pin, and `restateForecast`
 *    exists only to refuse — a past forecast is a historical claim, and
 *    changing it is how a measurement dispute becomes unwinnable.
 * 2. A minimum-n threshold is checked at *release* time against the cohort
 *    as it is now, not as it was when the rule was written. A cohort that
 *    was 400 people and is now 6 because a correction removed them must
 *    stop being releasable immediately.
 *
 * The non-goals — no live serving before contracts, no fabricated reach,
 * no cross-device identity claim, no export of named profiles — are
 * enforced as refusals rather than documented as intentions.
 */

export const RELEASE_MODES = [
  "aggregate_insight",
  "retailer_benchmark",
  "paon_executed_audience",
  "pseudonymous_attribution",
  "clean_room_match",
  "contracted_exchange",
  "own_tenant_export",
  "customer_requested_introduction",
] as const;
export type ReleaseMode = (typeof RELEASE_MODES)[number];

export interface ReleaseContext {
  readonly mode: ReleaseMode;
  readonly purpose: string;
  readonly contractRef?: string;
  readonly entitlementGranted: boolean;
  readonly cohortSize: number;
  /** Only meaningful for `customer_requested_introduction`. */
  readonly customerRequestRef?: string;
  readonly minimumN?: number;
}

export type ReleaseCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "purpose_required"
        | "contract_required"
        | "entitlement_absent"
        | "below_minimum_n"
        | "named_introduction_requires_customer_request"
        | "mode_cannot_export_named_profiles";
    };

const DEFAULT_MINIMUM_N = 25;

/** Modes that inherently need a signed contract before anything leaves. */
const CONTRACT_REQUIRED: readonly ReleaseMode[] = [
  "clean_room_match",
  "contracted_exchange",
  "paon_executed_audience",
];

/** Modes that operate on aggregates and must clear a minimum-n floor. */
const AGGREGATE_MODES: readonly ReleaseMode[] = [
  "aggregate_insight",
  "retailer_benchmark",
  "paon_executed_audience",
];

/**
 * The single gate every release passes through. Note the last refusal:
 * only `customer_requested_introduction` and `own_tenant_export` may carry
 * a named person, and the first requires the customer's own request on
 * record. Everything else is refused if it tries.
 */
export function checkRelease(args: {
  readonly context: ReleaseContext;
  readonly carriesNamedProfiles: boolean;
}): ReleaseCheck {
  const { context } = args;
  if (context.purpose.trim().length < 5) {
    return { ok: false, reason: "purpose_required" };
  }
  if (CONTRACT_REQUIRED.includes(context.mode) && !context.contractRef) {
    return { ok: false, reason: "contract_required" };
  }
  if (!context.entitlementGranted) {
    return { ok: false, reason: "entitlement_absent" };
  }
  if (
    AGGREGATE_MODES.includes(context.mode) &&
    context.cohortSize < (context.minimumN ?? DEFAULT_MINIMUM_N)
  ) {
    // Checked against the cohort as it is NOW. A cohort that was 400 and
    // is now 6 after a correction must stop being releasable immediately.
    return { ok: false, reason: "below_minimum_n" };
  }
  if (
    context.mode === "customer_requested_introduction" &&
    !context.customerRequestRef
  ) {
    return {
      ok: false,
      reason: "named_introduction_requires_customer_request",
    };
  }
  if (
    args.carriesNamedProfiles &&
    context.mode !== "customer_requested_introduction" &&
    context.mode !== "own_tenant_export"
  ) {
    return { ok: false, reason: "mode_cannot_export_named_profiles" };
  }
  return { ok: true };
}

export interface CohortVersion {
  readonly cohortId: string;
  readonly version: number;
  readonly ruleHash: string;
  readonly sizeAtVersion: number;
  readonly computedAt: string;
}

export type ActivationCheck =
  | { readonly ok: true; readonly pinnedVersion: number }
  | {
      readonly ok: false;
      readonly reason:
        | "no_cohort_version"
        | "rules_changed_since_forecast"
        | "entitlement_absent"
        | "serving_not_contracted";
    };

/**
 * Activation pins the cohort version so a later rule edit cannot restate a
 * past forecast or a past payable. Also refuses live serving without a
 * contract — the non-goal is explicit that provider-neutral local
 * capability is fine and live serving is not.
 */
export function checkActivation(args: {
  readonly version?: CohortVersion;
  readonly forecastRuleHash?: string;
  readonly entitlementGranted: boolean;
  readonly liveServing: boolean;
  readonly servingContractRef?: string;
}): ActivationCheck {
  if (!args.version) return { ok: false, reason: "no_cohort_version" };
  if (!args.entitlementGranted) {
    return { ok: false, reason: "entitlement_absent" };
  }
  if (
    args.forecastRuleHash !== undefined &&
    args.forecastRuleHash !== args.version.ruleHash
  ) {
    // The forecast the buyer agreed to was computed under different rules.
    // Activating anyway would sell them a number that no longer describes
    // what they are getting.
    return { ok: false, reason: "rules_changed_since_forecast" };
  }
  if (args.liveServing && !args.servingContractRef) {
    return { ok: false, reason: "serving_not_contracted" };
  }
  return { ok: true, pinnedVersion: args.version.version };
}

/**
 * Exists solely to refuse. A past forecast is a historical claim about
 * what was believed at a point in time; recomputing it under today's rules
 * makes a measurement dispute unwinnable, because nobody can show what was
 * originally said.
 */
export function restateForecast(): {
  readonly supported: false;
  readonly reason: string;
} {
  return {
    supported: false,
    reason:
      "A past forecast is immutable. Compute a new forecast against the " +
      "current cohort version; the original stays on record.",
  };
}

export interface PacingState {
  readonly budgetMinorUnits: number;
  readonly spentMinorUnits: number;
  readonly deliveredImpressions: number;
  readonly frequencyCap: number;
  readonly impressionsToThisRef: number;
}

export type DeliveryCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "budget_exhausted"
        | "frequency_cap_reached"
        | "flight_not_started"
        | "flight_ended"
        | "creative_not_reviewed";
    };

/**
 * Whether one more impression may be delivered. Pacing and frequency caps
 * are enforced here rather than reported afterwards: a cap you can only
 * observe after the fact is not a cap.
 */
export function checkDelivery(args: {
  readonly pacing: PacingState;
  readonly flightStart: string;
  readonly flightEnd: string;
  readonly asOf: string;
  readonly creativeReviewed: boolean;
}): DeliveryCheck {
  if (!args.creativeReviewed) {
    return { ok: false, reason: "creative_not_reviewed" };
  }
  if (Date.parse(args.asOf) < Date.parse(args.flightStart)) {
    return { ok: false, reason: "flight_not_started" };
  }
  if (Date.parse(args.asOf) > Date.parse(args.flightEnd)) {
    return { ok: false, reason: "flight_ended" };
  }
  if (args.pacing.spentMinorUnits >= args.pacing.budgetMinorUnits) {
    return { ok: false, reason: "budget_exhausted" };
  }
  if (args.pacing.impressionsToThisRef >= args.pacing.frequencyCap) {
    return { ok: false, reason: "frequency_cap_reached" };
  }
  return { ok: true };
}

export interface RevenueShare {
  readonly party:
    "retailer" | "publisher" | "partner" | "advertiser" | "paon_fee";
  readonly amountMinorUnits: number;
}

export interface ShareReversal {
  readonly party: RevenueShare["party"];
  readonly reversedMinorUnits: number;
}

/**
 * A refund reverses every share, not just the retailer's. Returning
 * reversal entries rather than mutating totals keeps the ledger
 * append-only: the original shares stay on record, which is what makes a
 * later dispute answerable.
 */
export function planShareReversal(args: {
  readonly shares: readonly RevenueShare[];
  readonly refundRatio: number;
}): readonly ShareReversal[] {
  const ratio = Math.min(Math.max(args.refundRatio, 0), 1);
  return args.shares
    .map((share) => ({
      party: share.party,
      reversedMinorUnits: Math.round(share.amountMinorUnits * ratio),
    }))
    .filter((reversal) => reversal.reversedMinorUnits > 0);
}

export type IdentityClaimCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        "cross_device_claim_unevidenced" | "deterministic_match_required";
    };

/**
 * Refuses a cross-device identity claim that rests on probabilistic
 * matching. The non-goal says "no cross-device identity claim without
 * evidence"; a deterministic match — the same signed-in account — is
 * evidence, a shared IP address is not.
 */
export function checkIdentityClaim(args: {
  readonly matchKind: "deterministic_account" | "probabilistic_signal";
  readonly claimsCrossDevice: boolean;
}): IdentityClaimCheck {
  if (!args.claimsCrossDevice) return { ok: true };
  if (args.matchKind !== "deterministic_account") {
    return { ok: false, reason: "cross_device_claim_unevidenced" };
  }
  return { ok: true };
}
