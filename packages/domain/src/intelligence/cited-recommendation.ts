/**
 * Advanced cited intelligence (PHASE 14.2).
 *
 * The non-goal is "no black-box owner dashboard", and the enforcement
 * mechanism is the type system: `CitedRecommendation` cannot be
 * constructed without at least one source, a projector version, an
 * observation window and a sample size. `buildRecommendation` is the only
 * constructor and it refuses every one of those omissions.
 *
 * Sample size is not decoration. A "hotspot" derived from four
 * appointments is noise, and presenting it beside one derived from four
 * hundred — with no way to tell them apart — is how an owner learns to
 * distrust the whole dashboard. `assessConfidence` returns
 * `insufficient_sample` rather than a rounded-up percentage.
 */

export const RECOMMENDATION_KINDS = [
  "temporal_hotspot",
  "interest_progression",
  "complete_look",
  "fit_risk",
  "production_risk",
  "stock_risk",
  "staffing_risk",
] as const;
export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number];

export interface EvidenceSource {
  /** Table or projection the number came from. */
  readonly sourceRef: string;
  /** Version of the projector that produced it. */
  readonly projectorVersion: string;
  readonly observedRows: number;
}

export interface ObservationWindow {
  readonly from: string;
  readonly to: string;
}

export interface CitedRecommendation {
  readonly kind: RecommendationKind;
  readonly statement: string;
  readonly sources: readonly EvidenceSource[];
  readonly window: ObservationWindow;
  readonly sampleSize: number;
  readonly confidence: ConfidenceBand;
  /** Ids of the underlying facts, so a correction can find what to
   * recompute. Without this, correcting a customer fact leaves a stale
   * recommendation on a dashboard with no way to locate it. */
  readonly derivedFromFactIds: readonly string[];
}

export const CONFIDENCE_BANDS = [
  "insufficient_sample",
  "indicative",
  "supported",
] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

const MIN_SAMPLE_INDICATIVE = 10;
const MIN_SAMPLE_SUPPORTED = 50;

/**
 * Bands rather than a percentage. A single number invites false precision
 * — "73% confident" from a sample of nine means nothing, but reads as
 * though it does.
 */
export function assessConfidence(sampleSize: number): ConfidenceBand {
  if (sampleSize < MIN_SAMPLE_INDICATIVE) return "insufficient_sample";
  if (sampleSize < MIN_SAMPLE_SUPPORTED) return "indicative";
  return "supported";
}

export type RecommendationBuild =
  | { readonly ok: true; readonly recommendation: CitedRecommendation }
  | {
      readonly ok: false;
      readonly reason:
        | "no_sources"
        | "projector_version_required"
        | "window_invalid"
        | "sample_size_not_positive"
        | "statement_required"
        | "sample_exceeds_observed_rows";
    };

/**
 * The only way to make a recommendation. Refusing here rather than
 * validating later is deliberate: a partially-cited recommendation that
 * exists in memory will eventually be rendered.
 */
export function buildRecommendation(args: {
  readonly kind: RecommendationKind;
  readonly statement: string;
  readonly sources: readonly EvidenceSource[];
  readonly window: ObservationWindow;
  readonly sampleSize: number;
  readonly derivedFromFactIds?: readonly string[];
}): RecommendationBuild {
  if (args.statement.trim().length === 0) {
    return { ok: false, reason: "statement_required" };
  }
  if (args.sources.length === 0) return { ok: false, reason: "no_sources" };
  for (const source of args.sources) {
    if (source.projectorVersion.trim().length === 0) {
      return { ok: false, reason: "projector_version_required" };
    }
  }
  if (Date.parse(args.window.to) <= Date.parse(args.window.from)) {
    return { ok: false, reason: "window_invalid" };
  }
  if (!Number.isInteger(args.sampleSize) || args.sampleSize <= 0) {
    return { ok: false, reason: "sample_size_not_positive" };
  }
  const observed = args.sources.reduce(
    (total, source) => total + source.observedRows,
    0,
  );
  if (args.sampleSize > observed) {
    // Claiming a larger sample than the sources actually contain is the
    // most direct way to make a weak finding look strong.
    return { ok: false, reason: "sample_exceeds_observed_rows" };
  }
  return {
    ok: true,
    recommendation: {
      kind: args.kind,
      statement: args.statement.trim(),
      sources: args.sources,
      window: args.window,
      sampleSize: args.sampleSize,
      confidence: assessConfidence(args.sampleSize),
      derivedFromFactIds: args.derivedFromFactIds ?? [],
    },
  };
}

export interface RecomputePlan {
  /** Recommendations that must be withdrawn and rebuilt. */
  readonly staleRecommendationKinds: readonly RecommendationKind[];
  readonly affectedFactIds: readonly string[];
  /** True when nothing on the dashboard depended on the corrected fact. */
  readonly noOp: boolean;
}

/**
 * What to recompute when a customer fact is corrected or deleted. The
 * item's acceptance criterion is that correction recomputes; the honest
 * implementation is to find everything derived from the fact and withdraw
 * it, rather than leaving it up until the next scheduled rebuild.
 */
export function planRecompute(args: {
  readonly correctedFactIds: readonly string[];
  readonly recommendations: readonly Pick<
    CitedRecommendation,
    "kind" | "derivedFromFactIds"
  >[];
}): RecomputePlan {
  const corrected = new Set(args.correctedFactIds);
  const affected = args.recommendations.filter((recommendation) =>
    recommendation.derivedFromFactIds.some((id) => corrected.has(id)),
  );
  return {
    staleRecommendationKinds: [
      ...new Set(affected.map((recommendation) => recommendation.kind)),
    ].sort(),
    affectedFactIds: [...corrected].sort(),
    noOp: affected.length === 0,
  };
}

export type HonestyCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "claims_stock_it_does_not_have"
        | "lead_time_shorter_than_supplier_states"
        | "claims_staff_presence_not_rostered";
    };

/**
 * Three claims a recommendation must never make, because each one turns a
 * suggestion into a promise the shop cannot keep in front of a customer:
 * offering stock that is not available, quoting a lead time shorter than
 * the supplier's own, or implying an advisor will be there when the roster
 * says otherwise.
 */
export function checkRecommendationHonesty(args: {
  readonly promisedQuantity?: number;
  readonly availableQuantity?: number;
  readonly quotedLeadTimeDays?: number;
  readonly supplierLeadTimeDays?: number;
  readonly impliesAdvisorPresent?: boolean;
  readonly advisorRostered?: boolean;
}): HonestyCheck {
  if (
    args.promisedQuantity !== undefined &&
    args.availableQuantity !== undefined &&
    args.promisedQuantity > args.availableQuantity
  ) {
    return { ok: false, reason: "claims_stock_it_does_not_have" };
  }
  if (
    args.quotedLeadTimeDays !== undefined &&
    args.supplierLeadTimeDays !== undefined &&
    args.quotedLeadTimeDays < args.supplierLeadTimeDays
  ) {
    return { ok: false, reason: "lead_time_shorter_than_supplier_states" };
  }
  if (args.impliesAdvisorPresent && args.advisorRostered === false) {
    return { ok: false, reason: "claims_staff_presence_not_rostered" };
  }
  return { ok: true };
}

export interface DashboardSection {
  readonly kind: RecommendationKind;
  readonly recommendations: readonly CitedRecommendation[];
}

/**
 * Assembles a role dashboard. Recommendations below the sample floor are
 * *kept and labelled*, not hidden: silently dropping them makes a sparse
 * dataset look like a confident one, which is the same lie as overstating
 * confidence, told by omission.
 */
export function buildRoleDashboard(args: {
  readonly recommendations: readonly CitedRecommendation[];
  readonly allowedKinds: readonly RecommendationKind[];
}): readonly DashboardSection[] {
  return args.allowedKinds
    .map((kind) => ({
      kind,
      recommendations: args.recommendations.filter(
        (recommendation) => recommendation.kind === kind,
      ),
    }))
    .filter((section) => section.recommendations.length > 0);
}
