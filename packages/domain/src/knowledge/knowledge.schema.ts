import { z } from "zod";

import type {
  KnowledgeCommercialIntent,
  KnowledgeDisplayType,
  KnowledgeTopic,
} from "./knowledge";

export const KNOWLEDGE_TOPICS = [
  "mill",
  "fibre",
  "fabric",
  "weave",
  "construction",
  "collar",
  "styling",
  "care",
  "performance",
  "occasion",
  "value",
  "tradeoff",
] as const satisfies readonly KnowledgeTopic[];

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

export const knowledgeTopicSchema = z.enum(KNOWLEDGE_TOPICS);
export const knowledgeDisplayTypeSchema = z.enum(KNOWLEDGE_DISPLAY_TYPES);
export const knowledgeCommercialIntentSchema = z.enum(
  KNOWLEDGE_COMMERCIAL_INTENTS,
);

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

const prioritySchema = z.number().int().min(-1000).max(1000);

export const createKnowledgeObjectInputSchema = z.object({
  retailerId: uuidSchema.nullable().default(null),
  topic: knowledgeTopicSchema,
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(120)
    .regex(knowledgeSlugPattern, "Lowercase letters, numbers and hyphens only"),
  summary: z.string().trim().min(1).max(2000),
  body: z.string().trim().min(1).max(20000).optional(),
  imageUrl: z.string().trim().url().max(2000).optional(),
  displayTypes: z
    .array(knowledgeDisplayTypeSchema)
    .min(1)
    .max(5)
    .refine(
      (values) => new Set(values).size === values.length,
      "Display types must be unique",
    ),
  commercialIntent: knowledgeCommercialIntentSchema,
  priority: prioritySchema.default(0),
  active: z.boolean().default(true),
});

export type CreateKnowledgeObjectInput = z.infer<
  typeof createKnowledgeObjectInputSchema
>;

export const updateKnowledgeObjectInputSchema = z.object({
  knowledgeObjectId: uuidSchema,
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2000),
  body: z.string().trim().min(1).max(20000).optional(),
  imageUrl: z.string().trim().url().max(2000).optional(),
  displayTypes: z
    .array(knowledgeDisplayTypeSchema)
    .min(1)
    .max(5)
    .refine(
      (values) => new Set(values).size === values.length,
      "Display types must be unique",
    ),
  commercialIntent: knowledgeCommercialIntentSchema,
  priority: prioritySchema,
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
  displayTitle: z.string().trim().min(1).max(200).optional(),
  summaryOverride: z.string().trim().min(1).max(2000).optional(),
  imageUrlOverride: z.string().trim().url().max(2000).optional(),
  isHidden: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  priorityOverride: prioritySchema.optional(),
});

export type CreateRetailerKnowledgeOverrideInput = z.infer<
  typeof createRetailerKnowledgeOverrideInputSchema
>;
