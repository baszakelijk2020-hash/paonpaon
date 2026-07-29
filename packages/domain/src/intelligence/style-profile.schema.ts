import { z } from "zod";

import {
  STYLE_EVIDENCE_SOURCES,
  STYLE_EVIDENCE_SUPPRESSION_ACTORS,
  STYLE_PREFERENCE_POLARITIES,
  type DeclaredStylePreference,
  type InferredStylePreference,
  type StyleProfileConfidence,
} from "./style-profile";

export const stylePreferencePolaritySchema = z.enum(
  STYLE_PREFERENCE_POLARITIES,
);
export const styleEvidenceSourceSchema = z.enum(STYLE_EVIDENCE_SOURCES);
export const styleEvidenceSuppressionActorSchema = z.enum(
  STYLE_EVIDENCE_SUPPRESSION_ACTORS,
);

export const upsertDeclaredStylePreferenceInputSchema = z.object({
  conceptId: z.string().uuid(),
  polarity: stylePreferencePolaritySchema,
  note: z.string().trim().max(500).optional(),
});

export type UpsertDeclaredStylePreferenceSchemaInput = z.infer<
  typeof upsertDeclaredStylePreferenceInputSchema
>;

export const removeInferredStylePreferenceInputSchema = z.object({
  conceptId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export type RemoveInferredStylePreferenceInput = z.infer<
  typeof removeInferredStylePreferenceInputSchema
>;

export const recordStyleEvidenceInputSchema = z.object({
  conceptId: z.string().uuid(),
  source: styleEvidenceSourceSchema,
  polarity: stylePreferencePolaritySchema,
  confidence: z.number().min(0).max(1),
  sourceEventId: z.string().uuid().optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
});

export type RecordStyleEvidenceSchemaInput = z.infer<
  typeof recordStyleEvidenceInputSchema
>;

export const declaredStylePreferenceSchema = z.object({
  conceptId: z.string().uuid(),
  polarity: stylePreferencePolaritySchema,
  note: z.string().max(500).optional(),
  updatedAt: z.string().datetime({ offset: true }),
});

export const styleInferenceFactorSchema = z.object({
  code: z.enum([
    "evidence_weight",
    "recency_decay",
    "polarity_sign",
    "source_weight",
    "explicit_precedence",
    "below_threshold",
    "contradiction_net",
  ]),
  delta: z.number(),
  detail: z.string(),
});

export const inferredStylePreferenceSchema = z.object({
  conceptId: z.string().uuid(),
  polarity: stylePreferencePolaritySchema,
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string().uuid()),
  lastEvidenceAt: z.string().datetime({ offset: true }),
  score: z.number(),
  factors: z.array(styleInferenceFactorSchema),
});

export const styleProfileConfidenceSchema = z.object({
  overall: z.number().min(0).max(1),
  inferredCount: z.number().int().nonnegative(),
  explicitCount: z.number().int().nonnegative(),
  activeEvidenceCount: z.number().int().nonnegative(),
});

export function parseDeclaredPreferences(
  value: unknown,
): DeclaredStylePreference[] {
  return z
    .array(declaredStylePreferenceSchema)
    .parse(value) as unknown as DeclaredStylePreference[];
}

export function parseInferredPreferences(
  value: unknown,
): InferredStylePreference[] {
  return z
    .array(inferredStylePreferenceSchema)
    .parse(value) as unknown as InferredStylePreference[];
}

export function parseStyleProfileConfidence(
  value: unknown,
): StyleProfileConfidence {
  return styleProfileConfidenceSchema.parse(value);
}
