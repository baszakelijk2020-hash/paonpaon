import { z } from "zod";

import type {
  KnowledgeCommercialIntent,
  KnowledgeDisplayType,
  KnowledgeEducationTopic,
  KnowledgeRelationKind,
} from "./knowledge";

export const KNOWLEDGE_DISPLAY_TYPES = [
  "information_card",
  "accordion",
  "tooltip",
  "comparison",
  "advisor_answer",
] as const satisfies readonly KnowledgeDisplayType[];

export const KNOWLEDGE_COMMERCIAL_INTENTS = [
  "educate",
  "justify_premium",
  "upgrade",
  "cross_sell",
  "appointment",
] as const satisfies readonly KnowledgeCommercialIntent[];

export const KNOWLEDGE_RELATION_KINDS = [
  "related",
  "prerequisite",
  "comparison",
  "follow_up",
] as const satisfies readonly KnowledgeRelationKind[];

export const KNOWLEDGE_EDUCATION_TOPICS = [
  "mills",
  "fibres",
  "fabrics",
  "weaves",
  "construction",
  "collars",
  "styling",
  "care",
  "performance",
  "occasion",
  "value",
  "tradeoffs",
] as const satisfies readonly KnowledgeEducationTopic[];

export const knowledgeDisplayTypeSchema = z.enum(KNOWLEDGE_DISPLAY_TYPES);
export const knowledgeCommercialIntentSchema = z.enum(
  KNOWLEDGE_COMMERCIAL_INTENTS,
);
export const knowledgeRelationKindSchema = z.enum(KNOWLEDGE_RELATION_KINDS);
export const knowledgeEducationTopicSchema = z.enum(KNOWLEDGE_EDUCATION_TOPICS);

const knowledgeSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidSchema = z.string().uuid();

function hasAtMostDecimalPlaces(value: number, decimalPlaces: number): boolean {
  const scale = 10 ** decimalPlaces;
  const scaledValue = value * scale;
  return Math.abs(scaledValue - Math.round(scaledValue)) < 1e-8;
}

const matchStrengthSchema = z
  .number()
  .finite()
  .min(0)
  .max(1)
  .refine((value) => hasAtMostDecimalPlaces(value, 4), {
    message: "Match strength supports at most four decimal places",
  });

export const createKnowledgeObjectInputSchema = z.object({
  retailerId: uuidSchema.nullable().default(null),
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(120)
    .regex(knowledgeSlugPattern, "Lowercase letters, numbers and hyphens only"),
  summary: z.string().trim().min(1).max(2000),
  body: z.string().trim().min(1).max(20_000).optional(),
  imageUrl: z.string().trim().url().max(2000).optional(),
  displayTypes: z
    .array(knowledgeDisplayTypeSchema)
    .min(1)
    .max(KNOWLEDGE_DISPLAY_TYPES.length),
  commercialIntent: knowledgeCommercialIntentSchema,
  educationTopic: knowledgeEducationTopicSchema,
  priority: z.number().int().min(-1000).max(1000).default(0),
  active: z.boolean().default(true),
});

export type CreateKnowledgeObjectInput = z.infer<
  typeof createKnowledgeObjectInputSchema
>;

export const updateKnowledgeObjectInputSchema = z.object({
  knowledgeObjectId: uuidSchema,
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2000),
  body: z.string().trim().min(1).max(20_000).optional(),
  imageUrl: z.string().trim().url().max(2000).optional(),
  displayTypes: z
    .array(knowledgeDisplayTypeSchema)
    .min(1)
    .max(KNOWLEDGE_DISPLAY_TYPES.length),
  commercialIntent: knowledgeCommercialIntentSchema,
  educationTopic: knowledgeEducationTopicSchema,
  priority: z.number().int().min(-1000).max(1000),
  active: z.boolean(),
});

export type UpdateKnowledgeObjectInput = z.infer<
  typeof updateKnowledgeObjectInputSchema
>;

export const createKnowledgeObjectConceptInputSchema = z.object({
  knowledgeObjectId: uuidSchema,
  conceptId: uuidSchema,
  matchStrength: matchStrengthSchema.default(1),
});

export type CreateKnowledgeObjectConceptInput = z.infer<
  typeof createKnowledgeObjectConceptInputSchema
>;

export const createKnowledgeObjectRelationInputSchema = z
  .object({
    sourceKnowledgeObjectId: uuidSchema,
    targetKnowledgeObjectId: uuidSchema,
    kind: knowledgeRelationKindSchema,
  })
  .refine(
    (value) => value.sourceKnowledgeObjectId !== value.targetKnowledgeObjectId,
    {
      message: "A knowledge relation cannot point to itself",
      path: ["targetKnowledgeObjectId"],
    },
  );

export type CreateKnowledgeObjectRelationInput = z.infer<
  typeof createKnowledgeObjectRelationInputSchema
>;

export const createRetailerKnowledgeOverrideInputSchema = z.object({
  retailerId: uuidSchema,
  knowledgeObjectId: uuidSchema,
  titleOverride: z.string().trim().min(1).max(200).optional(),
  summaryOverride: z.string().trim().min(1).max(2000).optional(),
  imageUrlOverride: z.string().trim().url().max(2000).optional(),
  isHidden: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  priorityOverride: z.number().int().min(-1000).max(1000).optional(),
});

export type CreateRetailerKnowledgeOverrideInput = z.infer<
  typeof createRetailerKnowledgeOverrideInputSchema
>;
