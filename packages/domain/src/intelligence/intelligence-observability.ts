/**
 * Aggregate intelligence observability (CLI-009 / PHASE 7.8 / ADR-066).
 * Admin health surfaces counts and versions only — never customer content.
 */

export const OBSERVABILITY_PROJECTOR_VERSION = "intelligence-observability-v1";

export const REGISTERED_PROJECTOR_VERSIONS = [
  "customer-interest-v1",
  "clienteling-opportunity-v1",
  "clienteling-dashboard-v1",
  "for-you-v1",
  "correction-replay-v1",
  "outcome-funnel-v1",
  "intelligence-policy-v1",
] as const;

export type RegisteredProjectorVersion =
  (typeof REGISTERED_PROJECTOR_VERSIONS)[number];

export const EXPLAINABILITY_HEALTH = [
  "healthy",
  "degraded",
  "unknown",
] as const;

export type ExplainabilityHealth = (typeof EXPLAINABILITY_HEALTH)[number];

export interface ProjectorVersionCount {
  readonly version: string;
  readonly count: number;
}

export interface IntelligenceHealthInput {
  readonly generatedAt: string;
  readonly eventCount24h: number;
  readonly ingestionLagSecondsP95: number | null;
  readonly correctionCount7d: number;
  readonly opportunityCount7d: number;
  readonly incorrectOpportunityCount7d: number;
  readonly suppressedInsightCount7d: number;
  readonly projectorVersionCounts: readonly ProjectorVersionCount[];
}

export interface IntelligenceHealthSnapshot {
  readonly generatedAt: string;
  readonly projectorVersion: string;
  readonly eventCount24h: number;
  readonly ingestionLagSecondsP95: number | null;
  readonly correctionCount7d: number;
  readonly correctionRate7d: number;
  readonly opportunityIncorrectRate7d: number;
  readonly suppressedInsightRate7d: number;
  readonly projectorVersions: readonly ProjectorVersionCount[];
  readonly explainabilityHealth: ExplainabilityHealth;
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

export function resolveExplainabilityHealth(args: {
  readonly correctionRate7d: number;
  readonly incorrectRate7d: number;
  readonly suppressedRate7d: number;
  readonly ingestionLagSecondsP95: number | null;
}): ExplainabilityHealth {
  if (args.ingestionLagSecondsP95 === null) return "unknown";
  if (args.ingestionLagSecondsP95 > 3600) return "degraded";
  if (args.incorrectRate7d > 0.25 || args.correctionRate7d > 0.2) {
    return "degraded";
  }
  if (args.suppressedRate7d > 0.6) return "degraded";
  return "healthy";
}

export function projectIntelligenceHealth(
  input: IntelligenceHealthInput,
): IntelligenceHealthSnapshot {
  const correctionRate7d = safeRate(
    input.correctionCount7d,
    Math.max(input.eventCount24h, input.correctionCount7d),
  );
  const opportunityIncorrectRate7d = safeRate(
    input.incorrectOpportunityCount7d,
    Math.max(input.opportunityCount7d, 1),
  );
  const suppressedInsightRate7d = safeRate(
    input.suppressedInsightCount7d,
    Math.max(input.eventCount24h, input.suppressedInsightCount7d),
  );

  const explainabilityHealth = resolveExplainabilityHealth({
    correctionRate7d,
    incorrectRate7d: opportunityIncorrectRate7d,
    suppressedRate7d: suppressedInsightRate7d,
    ingestionLagSecondsP95: input.ingestionLagSecondsP95,
  });

  return {
    generatedAt: input.generatedAt,
    projectorVersion: OBSERVABILITY_PROJECTOR_VERSION,
    eventCount24h: input.eventCount24h,
    ingestionLagSecondsP95: input.ingestionLagSecondsP95,
    correctionCount7d: input.correctionCount7d,
    correctionRate7d,
    opportunityIncorrectRate7d,
    suppressedInsightRate7d,
    projectorVersions: [...input.projectorVersionCounts].sort((a, b) =>
      b.count !== a.count
        ? b.count - a.count
        : a.version.localeCompare(b.version),
    ),
    explainabilityHealth,
  };
}
