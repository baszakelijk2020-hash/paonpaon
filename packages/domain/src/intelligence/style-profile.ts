/**
 * StyleProfile evidence and preference shapes (CUST-002, ADR-061 / PHASE 3.2).
 * Declared and inferred preferences stay structurally separate; every inference
 * links to auditable concept evidence.
 */

import type {
  BehavioralEventId,
  CustomerId,
  MetadataConceptId,
  RetailerId,
  StylePreferenceEvidenceId,
  StyleProfileId,
} from "../shared/branded-id";

export const EVIDENCE_POLARITIES = ["positive", "negative", "neutral"] as const;

export type EvidencePolarity = (typeof EVIDENCE_POLARITIES)[number];

export const STYLE_EVIDENCE_SOURCES = [
  "customer_declared",
  "interaction_event",
  "advisor_recorded",
] as const;

export type StyleEvidenceSource = (typeof STYLE_EVIDENCE_SOURCES)[number];

/** Customer-declared preference for one catalogue concept. */
export interface ExplicitStylePreference {
  readonly conceptId: MetadataConceptId;
  readonly polarity: EvidencePolarity;
  readonly declaredAt: string;
}

/** Explainable factor contributing to an inferred preference score. */
export interface StylePreferenceFactor {
  readonly code: string;
  readonly delta: number;
  readonly detail: string;
  readonly evidenceId?: StylePreferenceEvidenceId;
}

/** Cached deterministic inference for one concept. */
export interface InferredStylePreference {
  readonly conceptId: MetadataConceptId;
  readonly score: number;
  readonly confidence: number;
  readonly polarity: EvidencePolarity;
  readonly evidenceCount: number;
  readonly lastEvidenceAt: string;
  readonly factors: readonly StylePreferenceFactor[];
}

export interface StylePreferenceEvidence {
  readonly id: StylePreferenceEvidenceId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly conceptId: MetadataConceptId;
  readonly source: StyleEvidenceSource;
  readonly sourceEventId?: BehavioralEventId;
  readonly polarity: EvidencePolarity;
  readonly confidence: number;
  readonly createdAt: string;
  readonly removedAt?: string;
}

export interface StyleProfile {
  readonly id: StyleProfileId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly explicitPreferences: readonly ExplicitStylePreference[];
  readonly inferredPreferences: readonly InferredStylePreference[];
  readonly updatedAt: string;
  readonly recomputedAt?: string;
}

/** Active evidence row used by pure recomputation. */
export interface StyleEvidenceInput {
  readonly id: StylePreferenceEvidenceId;
  readonly conceptId: MetadataConceptId;
  readonly polarity: EvidencePolarity;
  readonly confidence: number;
  readonly createdAt: string;
}

export function isEvidencePolarity(value: string): value is EvidencePolarity {
  return (EVIDENCE_POLARITIES as readonly string[]).includes(value);
}

export function isStyleEvidenceSource(
  value: string,
): value is StyleEvidenceSource {
  return (STYLE_EVIDENCE_SOURCES as readonly string[]).includes(value);
}

export function netPolarity(score: number): EvidencePolarity {
  if (score > 0.05) return "positive";
  if (score < -0.05) return "negative";
  return "neutral";
}
