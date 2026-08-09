import { z } from "zod";

import { GARMENT_CATEGORIES } from "../production/production";

import { isOutfitSlotsConsistent } from "./outfit";
import { WARDROBE_ROADMAP_STATUSES } from "./roadmap";
import {
  OUTFIT_SLOT_KINDS,
  SARTORIAL_OWNERSHIP_KINDS,
  SARTORIAL_RELATIONS,
  SARTORIAL_REVIEW_STATUSES,
  SARTORIAL_RULE_KINDS,
  isSartorialRuleTenantCompatible,
} from "./sartorial";

export const outfitSlotKindSchema = z.enum(OUTFIT_SLOT_KINDS);
export const sartorialOwnershipKindSchema = z.enum(SARTORIAL_OWNERSHIP_KINDS);
export const sartorialRuleKindSchema = z.enum(SARTORIAL_RULE_KINDS);
export const sartorialRelationSchema = z.enum(SARTORIAL_RELATIONS);
export const sartorialReviewStatusSchema = z.enum(SARTORIAL_REVIEW_STATUSES);
export const wardrobeRoadmapStatusSchema = z.enum(WARDROBE_ROADMAP_STATUSES);

const optionalUuid = z.string().uuid().optional();
const optionalNotes = z.string().trim().max(2000).optional();

export const createSartorialRuleInputSchema = z
  .object({
    ownershipKind: sartorialOwnershipKindSchema,
    retailerId: optionalUuid,
    slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().min(1).max(500),
    ruleKind: sartorialRuleKindSchema,
    relation: sartorialRelationSchema,
    subjectSlotKind: outfitSlotKindSchema.optional(),
    objectSlotKind: outfitSlotKindSchema.optional(),
    subjectConceptId: optionalUuid,
    objectConceptId: optionalUuid,
    knowledgeObjectId: optionalUuid,
    explanation: z.string().trim().min(1).max(2000),
  })
  .superRefine((value, ctx) => {
    if (
      !isSartorialRuleTenantCompatible({
        ownershipKind: value.ownershipKind,
        retailerId: value.retailerId ?? null,
      })
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sartorial rule ownership and retailer_id are incompatible.",
      });
    }

    if (
      (value.ruleKind === "slot_compatibility" ||
        value.ruleKind === "complete_look") &&
      (!value.subjectSlotKind || !value.objectSlotKind)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Slot compatibility rules require subject and object slots.",
      });
    }
  });

export type CreateSartorialRuleInput = z.infer<
  typeof createSartorialRuleInputSchema
>;

export const reviewSartorialRuleInputSchema = z.object({
  ruleId: z.string().uuid(),
  decision: z.enum(["accepted", "rejected"]),
});

export type ReviewSartorialRuleInput = z.infer<
  typeof reviewSartorialRuleInputSchema
>;

const outfitSlotInputSchema = z.object({
  slotKind: outfitSlotKindSchema,
  label: z.string().trim().min(1).max(200),
  wardrobeItemId: optionalUuid,
  productId: optionalUuid,
  available: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(100),
});

export const createOutfitInputSchema = z
  .object({
    retailerId: z.string().uuid(),
    customerId: z.string().uuid(),
    roadmapId: optionalUuid,
    title: z.string().trim().min(1).max(200),
    occasionLabel: z.string().trim().max(120).optional(),
    notes: optionalNotes,
    isSuggestionGeneration: z.boolean().default(false),
    slots: z.array(outfitSlotInputSchema).min(1).max(6),
  })
  .superRefine((value, ctx) => {
    if (
      !isOutfitSlotsConsistent({
        slots: value.slots.map((slot) => ({
          slotKind: slot.slotKind,
          available: slot.available,
          wardrobeItemId: slot.wardrobeItemId ?? null,
          productId: slot.productId ?? null,
        })),
      })
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Outfit slots failed consistency rules.",
      });
    }
  });

export type CreateOutfitInput = z.infer<typeof createOutfitInputSchema>;

const roadmapGoalInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalNotes,
  displayOrder: z.number().int().min(0).max(100),
});

const roadmapGapInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalNotes,
  rank: z.number().int().min(1).max(100),
  slotKind: outfitSlotKindSchema.optional(),
  categoryCode: z.enum(GARMENT_CATEGORIES).optional(),
  filledByProductId: optionalUuid,
  filledByWardrobeItemId: optionalUuid,
  howPurchaseFillsGap: z.string().trim().max(1000).optional(),
});

const citationRuleSchema = z.object({
  ruleId: z.string().uuid(),
  ruleTitle: z.string().trim().min(1).max(200),
  relation: sartorialRelationSchema,
  explanation: z.string().trim().min(1).max(2000),
});

const citationFactSchema = z.object({
  sourceKind: z.enum([
    "wardrobe_item",
    "catalogue_product",
    "accepted_concept",
  ]),
  sourceId: z.string().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(1).max(500),
});

const roadmapStageInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalNotes,
  stageOrder: z.number().int().min(1).max(100),
  gapIndex: z.number().int().min(0).max(99).optional(),
  suggestedProductId: optionalUuid,
  suggestedWardrobeItemId: optionalUuid,
  explanation: z.string().trim().min(1).max(2000),
  ruleCitations: z.array(citationRuleSchema).min(1).max(10),
  factCitations: z.array(citationFactSchema).min(1).max(20),
});

export const createWardrobeRoadmapInputSchema = z.object({
  retailerId: z.string().uuid(),
  customerId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  summary: optionalNotes,
  horizonLabel: z.string().trim().max(80).optional(),
  goals: z.array(roadmapGoalInputSchema).min(1).max(20),
  gaps: z.array(roadmapGapInputSchema).min(1).max(40),
  stages: z.array(roadmapStageInputSchema).min(1).max(40),
});

export type CreateWardrobeRoadmapInput = z.infer<
  typeof createWardrobeRoadmapInputSchema
>;

export const transitionWardrobeRoadmapInputSchema = z.object({
  roadmapId: z.string().uuid(),
  action: z.enum([
    "submit_for_approval",
    "approve",
    "reject",
    "revise_to_draft",
    "archive",
  ]),
  note: z.string().trim().max(1000).optional(),
});

export type TransitionWardrobeRoadmapInput = z.infer<
  typeof transitionWardrobeRoadmapInputSchema
>;
