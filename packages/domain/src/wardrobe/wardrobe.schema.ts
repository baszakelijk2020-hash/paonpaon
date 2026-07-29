import { z } from "zod";

import { GARMENT_CATEGORIES } from "../production/production";

import {
  WARDROBE_CONDITION_STATES,
  WARDROBE_WEAR_FREQUENCIES,
} from "./wardrobe";

const trimmedText = (max: number) =>
  z.string().trim().min(1).max(max);

const optionalTrimmedText = (max: number) =>
  z.string().trim().max(max).optional();

export const createExternalWardrobeItemInputSchema = z.object({
  categoryCode: z.enum(GARMENT_CATEGORIES),
  title: trimmedText(200),
  description: optionalTrimmedText(2000),
  brand: optionalTrimmedText(120),
  photoUrl: z.string().url().max(2048).optional(),
  conditionState: z.enum(WARDROBE_CONDITION_STATES).optional(),
  fitNotes: optionalTrimmedText(2000),
  careNotes: optionalTrimmedText(2000),
  wearFrequency: z.enum(WARDROBE_WEAR_FREQUENCIES).optional(),
});

export type CreateExternalWardrobeItemSchemaInput = z.infer<
  typeof createExternalWardrobeItemInputSchema
>;

export const createRetailerPurchaseWardrobeItemInputSchema =
  createExternalWardrobeItemInputSchema.extend({
    productId: z.string().uuid().optional(),
    orderLineId: z.string().uuid().optional(),
    physicalGarmentId: z.string().uuid().optional(),
  });

export type CreateRetailerPurchaseWardrobeItemSchemaInput = z.infer<
  typeof createRetailerPurchaseWardrobeItemInputSchema
>;

export const updateWardrobeItemStateInputSchema = z.object({
  conditionState: z.enum(WARDROBE_CONDITION_STATES).optional(),
  fitNotes: optionalTrimmedText(2000),
  careNotes: optionalTrimmedText(2000),
  wearFrequency: z.enum(WARDROBE_WEAR_FREQUENCIES).optional(),
  lastWornAt: z.string().datetime({ offset: true }).optional(),
});

export type UpdateWardrobeItemStateSchemaInput = z.infer<
  typeof updateWardrobeItemStateInputSchema
>;

export const addWardrobeAdvisorNoteInputSchema = z.object({
  note: trimmedText(2000),
});

export type AddWardrobeAdvisorNoteSchemaInput = z.infer<
  typeof addWardrobeAdvisorNoteInputSchema
>;
