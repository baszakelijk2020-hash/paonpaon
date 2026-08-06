import { z } from "zod";

import { GARMENT_CATEGORIES } from "../production/production";

import {
  WARDROBE_ACTOR_KINDS,
  WARDROBE_CARE_STATES,
  WARDROBE_CONDITION_STATES,
  WARDROBE_FIT_PERCEPTIONS,
  WARDROBE_OWNERSHIP_EVENT_KINDS,
  WARDROBE_OWNERSHIP_KINDS,
  WARDROBE_PROVENANCE_SOURCES,
  WARDROBE_SERVICE_REQUEST_KINDS,
  WARDROBE_WEAR_FREQUENCIES,
  isWardrobeItemConsistent,
  type WardrobeItemConsistencyInput,
} from "./wardrobe";

export const wardrobeOwnershipKindSchema = z.enum(WARDROBE_OWNERSHIP_KINDS);
export const wardrobeProvenanceSourceSchema = z.enum(
  WARDROBE_PROVENANCE_SOURCES,
);
export const wardrobeConditionStateSchema = z.enum(WARDROBE_CONDITION_STATES);
export const wardrobeWearFrequencySchema = z.enum(WARDROBE_WEAR_FREQUENCIES);
export const wardrobeCareStateSchema = z.enum(WARDROBE_CARE_STATES);
export const wardrobeFitPerceptionSchema = z.enum(WARDROBE_FIT_PERCEPTIONS);
export const wardrobeActorKindSchema = z.enum(WARDROBE_ACTOR_KINDS);
export const wardrobeOwnershipEventKindSchema = z.enum(
  WARDROBE_OWNERSHIP_EVENT_KINDS,
);
export const wardrobeCategoryCodeSchema = z.enum(GARMENT_CATEGORIES);

const optionalUuid = z.string().uuid().optional();
const optionalNotes = z.string().trim().max(2000).optional();

export const createExternalWardrobeItemInputSchema = z
  .object({
    retailerId: z.string().uuid(),
    customerId: z.string().uuid(),
    categoryCode: wardrobeCategoryCodeSchema,
    displayName: z.string().trim().min(1).max(200),
    brand: z.string().trim().max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    condition: wardrobeConditionStateSchema.default("good"),
    wearFrequency: wardrobeWearFrequencySchema.optional(),
    careState: wardrobeCareStateSchema.default("current"),
    fitPerception: wardrobeFitPerceptionSchema.default("unknown"),
    careNotes: optionalNotes,
    fitNotes: optionalNotes,
    acquiredAt: z.string().datetime({ offset: true }).optional(),
    productId: optionalUuid,
    identifyingPhotoUrl: z.string().url().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    const consistency: WardrobeItemConsistencyInput = {
      ownershipKind: "external",
      provenanceSource: "customer_added",
      orderLineId: null,
      productId: value.productId ?? null,
      createdByActor: "customer",
      createdByStaffId: null,
      retiredAt: null,
      condition: value.condition,
    };
    if (!isWardrobeItemConsistent(consistency)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "External wardrobe item failed ownership rules.",
      });
    }
  });

export type CreateExternalWardrobeItemInput = z.infer<
  typeof createExternalWardrobeItemInputSchema
>;

export const createCatalogueWardrobeItemInputSchema = z
  .object({
    retailerId: z.string().uuid(),
    customerId: z.string().uuid(),
    categoryCode: wardrobeCategoryCodeSchema,
    displayName: z.string().trim().min(1).max(200),
    brand: z.string().trim().max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    condition: wardrobeConditionStateSchema.default("new"),
    wearFrequency: wardrobeWearFrequencySchema.optional(),
    careState: wardrobeCareStateSchema.default("current"),
    fitPerception: wardrobeFitPerceptionSchema.default("unknown"),
    careNotes: optionalNotes,
    fitNotes: optionalNotes,
    acquiredAt: z.string().datetime({ offset: true }).optional(),
    productId: z.string().uuid(),
    orderLineId: optionalUuid,
    physicalGarmentId: optionalUuid,
    identifyingPhotoUrl: z.string().url().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    const provenanceSource = value.orderLineId
      ? "order_line"
      : "catalogue_link";
    const consistency: WardrobeItemConsistencyInput = {
      ownershipKind: "retailer_purchased",
      provenanceSource,
      orderLineId: value.orderLineId ?? null,
      productId: value.productId,
      physicalGarmentId: value.physicalGarmentId ?? null,
      createdByActor: "advisor",
      createdByStaffId: "00000000-0000-4000-8000-000000000099",
      retiredAt: null,
      condition: value.condition,
    };
    if (!isWardrobeItemConsistent(consistency)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Catalogue wardrobe item failed ownership rules.",
      });
    }
  });

export type CreateCatalogueWardrobeItemInput = z.infer<
  typeof createCatalogueWardrobeItemInputSchema
>;

export const createAdvisorExternalWardrobeItemInputSchema = z
  .object({
    retailerId: z.string().uuid(),
    customerId: z.string().uuid(),
    categoryCode: wardrobeCategoryCodeSchema,
    displayName: z.string().trim().min(1).max(200),
    brand: z.string().trim().max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    condition: wardrobeConditionStateSchema.default("good"),
    wearFrequency: wardrobeWearFrequencySchema.optional(),
    careState: wardrobeCareStateSchema.default("current"),
    fitPerception: wardrobeFitPerceptionSchema.default("unknown"),
    careNotes: optionalNotes,
    fitNotes: optionalNotes,
    acquiredAt: z.string().datetime({ offset: true }).optional(),
    productId: optionalUuid,
    physicalGarmentId: optionalUuid,
    identifyingPhotoUrl: z.string().url().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    const consistency: WardrobeItemConsistencyInput = {
      ownershipKind: "external",
      provenanceSource: "advisor_added",
      orderLineId: null,
      productId: value.productId ?? null,
      physicalGarmentId: value.physicalGarmentId ?? null,
      createdByActor: "advisor",
      createdByStaffId: "00000000-0000-4000-8000-000000000099",
      retiredAt: null,
      condition: value.condition,
    };
    if (!isWardrobeItemConsistent(consistency)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Advisor external wardrobe item failed ownership rules.",
      });
    }
  });

export type CreateAdvisorExternalWardrobeItemInput = z.infer<
  typeof createAdvisorExternalWardrobeItemInputSchema
>;

export const updateWardrobeItemStateInputSchema = z.object({
  wardrobeItemId: z.string().uuid(),
  condition: wardrobeConditionStateSchema.optional(),
  wearFrequency: wardrobeWearFrequencySchema.optional().nullable(),
  careState: wardrobeCareStateSchema.optional(),
  fitPerception: wardrobeFitPerceptionSchema.optional(),
  careNotes: optionalNotes.nullable(),
  fitNotes: optionalNotes.nullable(),
  displayName: z.string().trim().min(1).max(200).optional(),
  brand: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});

export type UpdateWardrobeItemStateInput = z.infer<
  typeof updateWardrobeItemStateInputSchema
>;

export const retireWardrobeItemInputSchema = z.object({
  wardrobeItemId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});

export type RetireWardrobeItemInput = z.infer<
  typeof retireWardrobeItemInputSchema
>;

export const wardrobeServiceRequestKindSchema = z.enum(
  WARDROBE_SERVICE_REQUEST_KINDS,
);

export const requestWardrobeItemServiceInputSchema = z.object({
  wardrobeItemId: z.string().uuid(),
  retailerId: z.string().uuid(),
  kind: wardrobeServiceRequestKindSchema,
});

export type RequestWardrobeItemServiceInput = z.infer<
  typeof requestWardrobeItemServiceInputSchema
>;
