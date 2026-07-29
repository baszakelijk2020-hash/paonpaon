/**
 * StyleProfile evidence and deterministic recomputation (CUST-002,
 * ADR-061 / PHASE 3.2). Declared preferences stay structurally separate from
 * inferred preferences; every inference links concept evidence, polarity,
 * confidence, and recency.
 */

import type {
  BehavioralEventId,
  CustomerId,
  CustomerStyleProfileId,
  MetadataConceptId,
  RetailerId,
  StylePreferenceEvidenceId,
} from "../shared/branded-id";
import { asId } from "../shared/branded-id";

import type { InteractionEventName } from "./interaction-event";

export const STYLE_PREFERENCE_POLARITIES = [
  "positive",
  "negative",
  "neutral",
] as const;

export type StylePreferencePolarity =
  (typeof STYLE_PREFERENCE_POLARITIES)[number];

export const STYLE_EVIDENCE_SOURCES = [
  "declared",
  "product_viewed",
  "product_favorited",
  "product_skipped",
  "search_performed",
  "filter_applied",
  "cart_updated",
  "knowledge_opened",
  "advisor_question",
  "appointment_intent",
  "conversion_recorded",
] as const;

export type StyleEvidenceSource = (typeof STYLE_EVIDENCE_SOURCES)[number];

export const STYLE_EVIDENCE_SUPPRESSION_ACTORS = [
  "customer",
  "system",
  "withdrawal",
] as const;

export type StyleEvidenceSuppressionActor =
  (typeof STYLE_EVIDENCE_SUPPRESSION_ACTORS)[number];

/** Half-life for evidence recency decay (days). */
export const STYLE_EVIDENCE_HALF_LIFE_DAYS = 90;

/** Absolute net score below which a concept is omitted from inference. */
export const STYLE_INFERENCE_MIN_ABS_SCORE = 0.15;

/** Source weights for deterministic scoring (declared never enters inference). */
export const STYLE_EVIDENCE_SOURCE_WEIGHTS: Readonly<
  Record<Exclude<StyleEvidenceSource, "declared">, number>
> = {
  product_viewed: 0.3,
  product_favorited: 1.0,
  product_skipped: 0.9,
  search_performed: 0.5,
  filter_applied: 0.7,
  cart_updated: 0.8,
  knowledge_opened: 0.4,
  advisor_question: 0.6,
  appointment_intent: 0.7,
  conversion_recorded: 1.2,
};

export interface DeclaredStylePreference {
  readonly conceptId: MetadataConceptId;
  readonly polarity: StylePreferencePolarity;
  readonly note?: string;
  readonly updatedAt: string;
}

export interface StylePreferenceEvidence {
  readonly id: StylePreferenceEvidenceId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly conceptId: MetadataConceptId;
  readonly sourceEventId?: BehavioralEventId;
  readonly source: StyleEvidenceSource;
  readonly polarity: StylePreferencePolarity;
  readonly confidence: number;
  readonly createdAt: string;
  readonly suppressedAt?: string;
  readonly suppressedBy?: StyleEvidenceSuppressionActor;
  readonly suppressionReason?: string;
}

export interface StyleInferenceFactor {
  readonly code:
    | "evidence_weight"
    | "recency_decay"
    | "polarity_sign"
    | "source_weight"
    | "explicit_precedence"
    | "below_threshold"
    | "contradiction_net";
  readonly delta: number;
  readonly detail: string;
}

export interface InferredStylePreference {
  readonly conceptId: MetadataConceptId;
  readonly polarity: StylePreferencePolarity;
  readonly confidence: number;
  readonly evidenceIds: readonly StylePreferenceEvidenceId[];
  readonly lastEvidenceAt: string;
  readonly score: number;
  readonly factors: readonly StyleInferenceFactor[];
}

export interface StyleProfileConfidence {
  readonly overall: number;
  readonly inferredCount: number;
  readonly explicitCount: number;
  readonly activeEvidenceCount: number;
}

export interface CustomerStyleProfile {
  readonly id: CustomerStyleProfileId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly explicitPreferences: readonly DeclaredStylePreference[];
  readonly inferredPreferences: readonly InferredStylePreference[];
  readonly confidence: StyleProfileConfidence;
  readonly recomputedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RecordStyleEvidenceInput {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly conceptId: MetadataConceptId;
  readonly source: StyleEvidenceSource;
  readonly polarity: StylePreferencePolarity;
  readonly confidence: number;
  readonly createdAt: string;
  readonly sourceEventId?: BehavioralEventId;
}

export interface UpsertDeclaredStylePreferenceInput {
  readonly conceptId: MetadataConceptId;
  readonly polarity: StylePreferencePolarity;
  readonly note?: string;
  readonly updatedAt: string;
}

/**
 * Extract concept IDs from interaction event properties when producers
 * attach them. Supports `conceptId` (string) or `conceptIds` (string[]).
 */
export function conceptIdsFromEventProperties(
  properties: Readonly<Record<string, unknown>>,
): readonly MetadataConceptId[] {
  const ids: MetadataConceptId[] = [];
  const single = properties.conceptId;
  if (typeof single === "string" && single.length > 0) {
    ids.push(asId<"MetadataConceptId">(single));
  }
  const many = properties.conceptIds;
  if (Array.isArray(many)) {
    for (const value of many) {
      if (typeof value === "string" && value.length > 0) {
        ids.push(asId<"MetadataConceptId">(value));
      }
    }
  }
  return ids;
}

export function isStyleEvidenceSource(
  value: string,
): value is StyleEvidenceSource {
  return (STYLE_EVIDENCE_SOURCES as readonly string[]).includes(value);
}

export function polaritySign(polarity: StylePreferencePolarity): number {
  if (polarity === "positive") return 1;
  if (polarity === "negative") return -1;
  return 0;
}

export function polarityFromScore(score: number): StylePreferencePolarity {
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

/**
 * Exponential recency decay with a fixed half-life. Deterministic for a
 * given (createdAt, now) pair.
 */
export function evidenceRecencyWeight(args: {
  readonly createdAt: string;
  readonly now: string;
  readonly halfLifeDays?: number;
}): number {
  const created = Date.parse(args.createdAt);
  const now = Date.parse(args.now);
  if (Number.isNaN(created) || Number.isNaN(now)) {
    throw new Error("Invalid timestamps for evidence recency");
  }
  const ageMs = Math.max(0, now - created);
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const halfLife = args.halfLifeDays ?? STYLE_EVIDENCE_HALF_LIFE_DAYS;
  return 0.5 ** (ageDays / halfLife);
}

export function isActiveEvidence(evidence: StylePreferenceEvidence): boolean {
  return evidence.suppressedAt === undefined;
}

export function hasExplicitPreferenceForConcept(
  explicit: readonly DeclaredStylePreference[],
  conceptId: MetadataConceptId,
): boolean {
  return explicit.some((pref) => pref.conceptId === conceptId);
}

/**
 * Map a typed interaction event name to an evidence source. Declared is
 * never derived from events.
 */
export function evidenceSourceFromEventName(
  name: InteractionEventName,
): Exclude<StyleEvidenceSource, "declared"> | null {
  if (name === "category_browsed") return "filter_applied";
  if (isStyleEvidenceSource(name)) {
    return name as Exclude<StyleEvidenceSource, "declared">;
  }
  return null;
}

/**
 * Default polarity for an interaction when recording concept evidence.
 * Skips are negative; most engagement is positive; searches/filters are
 * neutral interest signals.
 */
export function defaultPolarityForEvidenceSource(
  source: StyleEvidenceSource,
): StylePreferencePolarity {
  if (source === "product_skipped") return "negative";
  if (source === "search_performed" || source === "filter_applied") {
    return "neutral";
  }
  if (source === "declared") return "positive";
  return "positive";
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, Math.round(value * 1000) / 1000));
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Deterministic StyleProfile recomputation. Explicit preferences never
 * appear in inferred output and block inference for the same concept.
 * Suppressed evidence is ignored. Idempotent for the same inputs.
 */
export function recomputeInferredPreferences(args: {
  readonly explicitPreferences: readonly DeclaredStylePreference[];
  readonly evidence: readonly StylePreferenceEvidence[];
  readonly now: string;
}): {
  readonly inferredPreferences: readonly InferredStylePreference[];
  readonly confidence: StyleProfileConfidence;
} {
  const active = args.evidence
    .filter(isActiveEvidence)
    .filter((row) => row.source !== "declared")
    .slice()
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt < b.createdAt ? -1 : 1;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  const byConcept = new Map<MetadataConceptId, StylePreferenceEvidence[]>();
  for (const row of active) {
    const list = byConcept.get(row.conceptId) ?? [];
    list.push(row);
    byConcept.set(row.conceptId, list);
  }

  const conceptIds = [...byConcept.keys()].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );

  const inferred: InferredStylePreference[] = [];

  for (const conceptId of conceptIds) {
    // Declared preferences structurally block inference for the same concept.
    if (hasExplicitPreferenceForConcept(args.explicitPreferences, conceptId)) {
      continue;
    }

    const rows = byConcept.get(conceptId) ?? [];
    let net = 0;
    const factors: StyleInferenceFactor[] = [];
    const evidenceIds: StylePreferenceEvidenceId[] = [];
    let lastEvidenceAt = rows[0]?.createdAt ?? args.now;
    let positiveWeight = 0;
    let negativeWeight = 0;

    for (const row of rows) {
      const sourceWeight =
        STYLE_EVIDENCE_SOURCE_WEIGHTS[
          row.source as Exclude<StyleEvidenceSource, "declared">
        ] ?? 0;
      const recency = evidenceRecencyWeight({
        createdAt: row.createdAt,
        now: args.now,
      });
      const sign = polaritySign(row.polarity);
      const contribution = roundScore(
        sign * row.confidence * sourceWeight * recency,
      );
      net = roundScore(net + contribution);
      evidenceIds.push(row.id);
      if (row.createdAt > lastEvidenceAt) lastEvidenceAt = row.createdAt;
      if (sign > 0) {
        positiveWeight = roundScore(positiveWeight + Math.abs(contribution));
      }
      if (sign < 0) {
        negativeWeight = roundScore(negativeWeight + Math.abs(contribution));
      }

      factors.push({
        code: "evidence_weight",
        delta: contribution,
        detail: `${row.source} ${row.polarity} confidence=${row.confidence}`,
      });
      factors.push({
        code: "source_weight",
        delta: sourceWeight,
        detail: `source weight for ${row.source}`,
      });
      factors.push({
        code: "recency_decay",
        delta: recency,
        detail: `recency weight at ${row.createdAt}`,
      });
      factors.push({
        code: "polarity_sign",
        delta: sign,
        detail: `polarity ${row.polarity}`,
      });
    }

    if (positiveWeight > 0 && negativeWeight > 0) {
      factors.push({
        code: "contradiction_net",
        delta: net,
        detail: `net after contradiction (+${positiveWeight} / -${negativeWeight})`,
      });
    }

    const absNet = Math.abs(net);
    if (absNet < STYLE_INFERENCE_MIN_ABS_SCORE) {
      factors.push({
        code: "below_threshold",
        delta: absNet,
        detail: `abs score ${absNet} below ${STYLE_INFERENCE_MIN_ABS_SCORE}`,
      });
      continue;
    }

    const confidence = clampConfidence(Math.min(1, absNet));
    inferred.push({
      conceptId,
      polarity: polarityFromScore(net),
      confidence,
      evidenceIds,
      lastEvidenceAt,
      score: net,
      factors,
    });
  }

  const overall =
    inferred.length === 0
      ? 0
      : clampConfidence(
          inferred.reduce((sum, row) => sum + row.confidence, 0) /
            inferred.length,
        );

  return {
    inferredPreferences: inferred,
    confidence: {
      overall,
      inferredCount: inferred.length,
      explicitCount: args.explicitPreferences.length,
      activeEvidenceCount: active.length,
    },
  };
}

/**
 * Merge a declared preference into the explicit list without touching
 * inferred state. Same concept replaces prior declaration.
 */
export function upsertDeclaredPreference(
  existing: readonly DeclaredStylePreference[],
  input: UpsertDeclaredStylePreferenceInput,
): readonly DeclaredStylePreference[] {
  const next: DeclaredStylePreference[] = existing
    .filter((row) => row.conceptId !== input.conceptId)
    .map((row) => ({ ...row }));
  next.push({
    conceptId: input.conceptId,
    polarity: input.polarity,
    ...(input.note ? { note: input.note } : {}),
    updatedAt: input.updatedAt,
  });
  return next.sort((a, b) =>
    a.conceptId < b.conceptId ? -1 : a.conceptId > b.conceptId ? 1 : 0,
  );
}

/**
 * Remove a declared preference by concept. Does not delete evidence history.
 */
export function removeDeclaredPreference(
  existing: readonly DeclaredStylePreference[],
  conceptId: MetadataConceptId,
): readonly DeclaredStylePreference[] {
  return existing.filter((row) => row.conceptId !== conceptId);
}

/**
 * Soft-suppress active inferred evidence for a concept. Lawful business
 * history (events, evidence rows) remains; recomputation ignores them.
 */
export function suppressEvidenceForConcept(args: {
  readonly evidence: readonly StylePreferenceEvidence[];
  readonly conceptId: MetadataConceptId;
  readonly suppressedAt: string;
  readonly suppressedBy: StyleEvidenceSuppressionActor;
  readonly reason?: string;
}): readonly StylePreferenceEvidence[] {
  return args.evidence.map((row) => {
    if (row.conceptId !== args.conceptId) return row;
    if (row.source === "declared") return row;
    if (row.suppressedAt) return row;
    return {
      ...row,
      suppressedAt: args.suppressedAt,
      suppressedBy: args.suppressedBy,
      ...(args.reason ? { suppressionReason: args.reason } : {}),
    };
  });
}
