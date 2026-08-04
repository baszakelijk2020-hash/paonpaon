/**
 * Corporate analytics and renewal engine (BD-109 / PHASE 18.9).
 *
 * The renewal-risk signal reuses `cited_recommendations` (14.2) — a new
 * `corporate_renewal_risk` kind, not a second citation mechanism —
 * because "no black-box owner dashboard" is exactly the constraint this
 * item's own non-goal restates, and `buildRecommendation` already
 * refuses every uncited, unsourced, or oversized-sample claim.
 */

export interface CorporateProgrammeMetrics {
  readonly wearerCount: number;
  readonly activeWearerCount: number;
  /** Wearers with at least one issued garment. */
  readonly fulfilledWearerCount: number;
  /** Exceptions of kind damaged/missing/replacement_request. */
  readonly damageEventCount: number;
  readonly participationRate: number;
  readonly fulfilmentRate: number;
  /** Damage events per wearer — not a rate capped at 1, since one wearer
   * can have more than one damage event. */
  readonly damageRatePerWearer: number;
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function computeCorporateProgrammeMetrics(args: {
  readonly wearerCount: number;
  readonly activeWearerCount: number;
  readonly fulfilledWearerCount: number;
  readonly damageEventCount: number;
}): CorporateProgrammeMetrics {
  return {
    wearerCount: args.wearerCount,
    activeWearerCount: args.activeWearerCount,
    fulfilledWearerCount: args.fulfilledWearerCount,
    damageEventCount: args.damageEventCount,
    participationRate: safeRatio(args.activeWearerCount, args.wearerCount),
    fulfilmentRate: safeRatio(args.fulfilledWearerCount, args.wearerCount),
    damageRatePerWearer: safeRatio(args.damageEventCount, args.wearerCount),
  };
}

export const RENEWAL_RISK_LEVELS = ["low", "medium", "high"] as const;
export type RenewalRiskLevel = (typeof RENEWAL_RISK_LEVELS)[number];

export interface RenewalRiskFactor {
  readonly factor: string;
  readonly value: number;
  readonly weight: number;
}

export interface RenewalRiskAssessment {
  readonly level: RenewalRiskLevel;
  readonly score: number;
  readonly factors: readonly RenewalRiskFactor[];
}

/**
 * A plain, published weighted formula — no model call, nothing hidden.
 * Low participation and low fulfilment push risk up; a live damage rate
 * pushes it up further. Every factor that contributed is returned
 * alongside the total, so a manager can recompute the score by hand
 * rather than trust a single unexplained number.
 */
export function assessRenewalRisk(
  metrics: CorporateProgrammeMetrics,
): RenewalRiskAssessment {
  const factors: RenewalRiskFactor[] = [
    {
      factor: "low_participation",
      value: 1 - metrics.participationRate,
      weight: 40,
    },
    {
      factor: "low_fulfilment",
      value: 1 - metrics.fulfilmentRate,
      weight: 40,
    },
    {
      factor: "damage_rate",
      value: Math.min(metrics.damageRatePerWearer, 1),
      weight: 20,
    },
  ];
  const score = factors.reduce((total, f) => total + f.value * f.weight, 0);
  const level: RenewalRiskLevel =
    score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  return { level, score: Math.round(score), factors };
}

/** A renewal task is created only when risk is genuinely elevated, and
 * only once — a programme already carrying an open task must not
 * accumulate a second one every time analytics recompute. */
export function shouldCreateRenewalTask(args: {
  readonly level: RenewalRiskLevel;
  readonly hasOpenTask: boolean;
}): boolean {
  return args.level !== "low" && !args.hasOpenTask;
}
