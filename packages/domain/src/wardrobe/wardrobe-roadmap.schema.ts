import { z } from "zod";

import {
  OUTFIT_SLOT_KINDS,
  OUTFIT_STATUSES,
  isOutfitSlotReferenceValid,
  type OutfitSlotReferenceInput,
} from "./outfit";
import {
  WARDROBE_GAP_STATUSES,
  WARDROBE_ROADMAP_STATUSES,
} from "./wardrobe-roadmap";

export const outfitSlotKindSchema = z.enum(OUTFIT_SLOT_KINDS);
export const outfitStatusSchema = z.enum(OUTFIT_STATUSES);
export const wardrobeRoadmapStatusSchema = z.enum(WARDROBE_ROADMAP_STATUSES);
export const wardrobeGapStatusSchema = z.enum(WARDROBE_GAP_STATUSES);

const optionalUuid = z.string().uuid().optional();
const optionalNotes = z.string().trim().max(2000).optional();

export const outfitSlotInputSchema = z
  .object({
    slotKind: outfitSlotKindSchema,
    displayLabel: z.string().trim().min(1).max(200),
    wardrobeItemId: optionalUuid.nullable(),
    productId: optionalUuid.nullable(),
  })
  .superRefine((value, ctx) => {
    const input: OutfitSlotReferenceInput = {
      slotKind: value.slotKind,
      displayLabel: value.displayLabel,
      wardrobeItemId: value.wardrobeItemId ?? null,
      productId: value.productId ?? null,
    };
    if (!isOutfitSlotReferenceValid(input)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Outfit slot must reference wardrobe or catalogue, or carry a label.",
      });
    }
  });

export type OutfitSlotInput = z.infer<typeof outfitSlotInputSchema>;

export const createOutfitInputSchema = z.object({
  retailerId: z.string().uuid(),
  customerId: z.string().uuid(),
  roadmapId: optionalUuid,
  title: z.string().trim().min(1).max(200),
  occasionLabel: z.string().trim().max(120).optional(),
  slots: z.array(outfitSlotInputSchema).min(1).max(12),
  knowledgeObjectIds: z.array(z.string().uuid()).max(8).default([]),
});

export type CreateOutfitInput = z.infer<typeof createOutfitInputSchema>;

export const createWardrobeRoadmapInputSchema = z.object({
  retailerId: z.string().uuid(),
  customerId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  summary: optionalNotes,
  horizonLabel: z.string().trim().max(80).optional(),
});

export type CreateWardrobeRoadmapInput = z.infer<
  typeof createWardrobeRoadmapInputSchema
>;

export const createWardrobeGoalInputSchema = z.object({
  roadmapId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: optionalNotes,
  rank: z.number().int().min(1).max(99),
});

export type CreateWardrobeGoalInput = z.infer<
  typeof createWardrobeGoalInputSchema
>;

export const createWardrobeGapInputSchema = z.object({
  roadmapId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: optionalNotes,
  slotKind: outfitSlotKindSchema,
  rank: z.number().int().min(1).max(99),
  stagePriority: z.number().int().min(1).max(5).default(1),
  conceptId: optionalUuid,
  productId: optionalUuid,
  wardrobeItemId: optionalUuid,
  knowledgeObjectId: optionalUuid,
});

export type CreateWardrobeGapInput = z.infer<
  typeof createWardrobeGapInputSchema
>;

export const transitionRoadmapStatusInputSchema = z.object({
  roadmapId: z.string().uuid(),
  status: wardrobeRoadmapStatusSchema,
});

export type TransitionRoadmapStatusInput = z.infer<
  typeof transitionRoadmapStatusInputSchema
>;

export const transitionOutfitStatusInputSchema = z.object({
  outfitId: z.string().uuid(),
  status: outfitStatusSchema,
});

export type TransitionOutfitStatusInput = z.infer<
  typeof transitionOutfitStatusInputSchema
>;
