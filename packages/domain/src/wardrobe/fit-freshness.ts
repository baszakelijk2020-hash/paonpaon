/**
 * Official fit freshness projection (FIT-002, ADR-016/055).
 * Uses only staff-recorded fitting session dates — never self-reports.
 */

export const FIT_FRESHNESS_LEVELS = [
  "never_measured",
  "current",
  "due_soon",
  "stale",
  "very_stale",
] as const;

export type FitFreshnessLevel = (typeof FIT_FRESHNESS_LEVELS)[number];

export const FIT_FRESHNESS_ACTIONS = [
  "none",
  "book_fitting",
  "discuss_alteration",
] as const;

export type FitFreshnessSuggestedAction =
  (typeof FIT_FRESHNESS_ACTIONS)[number];

export interface FitFreshnessProjection {
  readonly level: FitFreshnessLevel;
  readonly label: string;
  readonly explanation: string;
  readonly lastOfficialMeasuredAt: string | null;
  readonly daysSinceOfficialMeasurement: number | null;
  readonly suggestedAction: FitFreshnessSuggestedAction;
}

const MS_PER_DAY = 86_400_000;

/** Escalating thresholds in days since last official measurement. */
export const FIT_FRESHNESS_THRESHOLDS = {
  currentMaxDays: 180,
  dueSoonMaxDays: 365,
  staleMaxDays: 730,
} as const;

function daysSince(iso: string, nowIso: string): number {
  const measured = Date.parse(iso);
  const now = Date.parse(nowIso);
  if (Number.isNaN(measured) || Number.isNaN(now) || now < measured) {
    return 0;
  }
  return Math.floor((now - measured) / MS_PER_DAY);
}

/**
 * Deterministic fit freshness from the last official fitting session date.
 * Self-reported dates must never be passed here.
 */
export function projectFitFreshness(params: {
  readonly lastOfficialMeasuredAt: string | null | undefined;
  readonly now: string;
}): FitFreshnessProjection {
  const lastOfficial = params.lastOfficialMeasuredAt ?? null;

  if (!lastOfficial) {
    return {
      level: "never_measured",
      label: "Not yet measured in store",
      explanation:
        "No official in-store fitting is recorded for this garment yet. Self-reported notes stay separate from formal observations.",
      lastOfficialMeasuredAt: null,
      daysSinceOfficialMeasurement: null,
      suggestedAction: "book_fitting",
    };
  }

  const elapsed = daysSince(lastOfficial, params.now);
  const { currentMaxDays, dueSoonMaxDays, staleMaxDays } =
    FIT_FRESHNESS_THRESHOLDS;

  if (elapsed <= currentMaxDays) {
    return {
      level: "current",
      label: "Fit recently confirmed",
      explanation: `Last official measurement was ${elapsed} day${elapsed === 1 ? "" : "s"} ago. Body and cloth both change slowly — no action needed yet.`,
      lastOfficialMeasuredAt: lastOfficial,
      daysSinceOfficialMeasurement: elapsed,
      suggestedAction: "none",
    };
  }

  if (elapsed <= dueSoonMaxDays) {
    return {
      level: "due_soon",
      label: "Fit check worth scheduling",
      explanation: `It has been ${elapsed} days since the last official fitting. A brief in-store check keeps alterations accurate.`,
      lastOfficialMeasuredAt: lastOfficial,
      daysSinceOfficialMeasurement: elapsed,
      suggestedAction: "book_fitting",
    };
  }

  if (elapsed <= staleMaxDays) {
    return {
      level: "stale",
      label: "Fit may have shifted",
      explanation: `Last official measurement was ${elapsed} days ago. Many clients choose a fit update or alteration review at this stage.`,
      lastOfficialMeasuredAt: lastOfficial,
      daysSinceOfficialMeasurement: elapsed,
      suggestedAction: "book_fitting",
    };
  }

  return {
    level: "very_stale",
    label: "Fit refresh recommended",
    explanation: `It has been over ${Math.floor(elapsed / 365)} year${Math.floor(elapsed / 365) === 1 ? "" : "s"} since an official fitting. Book a fit update or discuss alterations before relying on prior measurements.`,
    lastOfficialMeasuredAt: lastOfficial,
    daysSinceOfficialMeasurement: elapsed,
    suggestedAction: "discuss_alteration",
  };
}
