/**
 * Deterministic StyleProfile recomputation (CUST-002, ENG-002).
 * Explicit preferences never merge into inferred output; they take precedence
 * by exclusion. Evidence decays with recency and aggregates by concept.
 */

import type {
  ExplicitStylePreference,
  InferredStylePreference,
  StyleEvidenceInput,
  StylePreferenceFactor,
} from "./style-profile";
import { netPolarity } from "./style-profile";

/** Recency half-life for personalization evidence (days). */
export const STYLE_EVIDENCE_HALF_LIFE_DAYS = 90;

/** Minimum absolute score required to surface an inferred preference. */
export const STYLE_INFERENCE_SCORE_THRESHOLD = 0.15;

const POLARITY_WEIGHT: Record<StyleEvidenceInput["polarity"], number> = {
  positive: 1,
  negative: -1,
  neutral: 0.2,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    throw new Error("Invalid ISO timestamp for style evidence decay");
  }
  return Math.max(0, (to - from) / (24 * 60 * 60 * 1000));
}

function recencyFactor(createdAt: string, now: string): number {
  const days = daysBetween(createdAt, now);
  return Math.exp(-days / STYLE_EVIDENCE_HALF_LIFE_DAYS);
}

function evidenceContribution(
  evidence: StyleEvidenceInput,
  now: string,
): { readonly delta: number; readonly factor: StylePreferenceFactor } {
  const decay = recencyFactor(evidence.createdAt, now);
  const confidence = clamp(evidence.confidence, 0, 1);
  const delta = POLARITY_WEIGHT[evidence.polarity] * confidence * decay;
  return {
    delta,
    factor: {
      code: "evidence_contribution",
      delta,
      detail: `${evidence.polarity} evidence (${confidence.toFixed(2)} confidence, ${decay.toFixed(2)} recency)`,
      evidenceId: evidence.id,
    },
  };
}

export interface RecomputeStyleProfileInput {
  readonly explicitPreferences: readonly ExplicitStylePreference[];
  readonly evidence: readonly StyleEvidenceInput[];
  readonly now: string;
}

export interface RecomputeStyleProfileResult {
  readonly inferredPreferences: readonly InferredStylePreference[];
}

/**
 * Idempotent, explainable inference from active evidence. Concepts with an
 * explicit declaration are omitted from inferred output (explicit precedence).
 */
export function recomputeStyleProfile(
  input: RecomputeStyleProfileInput,
): RecomputeStyleProfileResult {
  const explicitConceptIds = new Set(
    input.explicitPreferences.map((pref) => String(pref.conceptId)),
  );

  const byConcept = new Map<
    string,
    {
      factors: StylePreferenceFactor[];
      score: number;
      confidenceTotal: number;
      evidenceCount: number;
      lastEvidenceAt: string;
    }
  >();

  for (const row of input.evidence) {
    if (explicitConceptIds.has(String(row.conceptId))) continue;

    const key = String(row.conceptId);
    const bucket = byConcept.get(key) ?? {
      factors: [],
      score: 0,
      confidenceTotal: 0,
      evidenceCount: 0,
      lastEvidenceAt: row.createdAt,
    };

    const { delta, factor } = evidenceContribution(row, input.now);
    bucket.factors.push(factor);
    bucket.score += delta;
    bucket.confidenceTotal += clamp(row.confidence, 0, 1);
    bucket.evidenceCount += 1;
    if (Date.parse(row.createdAt) >= Date.parse(bucket.lastEvidenceAt)) {
      bucket.lastEvidenceAt = row.createdAt;
    }
    byConcept.set(key, bucket);
  }

  const inferredPreferences: InferredStylePreference[] = [];

  for (const [conceptKey, bucket] of byConcept.entries()) {
    const absScore = Math.abs(bucket.score);
    if (absScore < STYLE_INFERENCE_SCORE_THRESHOLD) continue;

    const confidence = clamp(
      bucket.confidenceTotal / Math.max(bucket.evidenceCount, 1),
      0,
      1,
    );

    inferredPreferences.push({
      conceptId: conceptKey as InferredStylePreference["conceptId"],
      score: bucket.score,
      confidence,
      polarity: netPolarity(bucket.score),
      evidenceCount: bucket.evidenceCount,
      lastEvidenceAt: bucket.lastEvidenceAt,
      factors: bucket.factors,
    });
  }

  inferredPreferences.sort((left, right) => {
    const scoreDelta = Math.abs(right.score) - Math.abs(left.score);
    if (scoreDelta !== 0) return scoreDelta;
    return String(left.conceptId).localeCompare(String(right.conceptId));
  });

  return { inferredPreferences };
}
