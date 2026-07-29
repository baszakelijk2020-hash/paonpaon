import { z } from "zod";

import { EVIDENCE_POLARITIES, STYLE_EVIDENCE_SOURCES } from "./style-profile";

const uuidSchema = z.string().uuid();

export const evidencePolaritySchema = z.enum(EVIDENCE_POLARITIES);

export const styleEvidenceSourceSchema = z.enum(STYLE_EVIDENCE_SOURCES);

export const explicitStylePreferenceSchema = z.object({
  conceptId: uuidSchema,
  polarity: evidencePolaritySchema,
  declaredAt: z.string().datetime(),
});

export const stylePreferenceFactorSchema = z.object({
  code: z.string().min(1),
  delta: z.number(),
  detail: z.string().min(1),
  evidenceId: uuidSchema.optional(),
});

export const inferredStylePreferenceSchema = z.object({
  conceptId: uuidSchema,
  score: z.number(),
  confidence: z.number().min(0).max(1),
  polarity: evidencePolaritySchema,
  evidenceCount: z.number().int().min(1),
  lastEvidenceAt: z.string().datetime(),
  factors: z.array(stylePreferenceFactorSchema),
});

export const setExplicitStylePreferenceInputSchema = z.object({
  conceptId: uuidSchema,
  polarity: evidencePolaritySchema,
});

export type SetExplicitStylePreferenceInput = z.infer<
  typeof setExplicitStylePreferenceInputSchema
>;

export const removeStylePreferenceEvidenceInputSchema = z.object({
  evidenceId: uuidSchema,
});

export type RemoveStylePreferenceEvidenceInput = z.infer<
  typeof removeStylePreferenceEvidenceInputSchema
>;
