import { z } from "zod";

import {
  MORNING_ROUTINE_ACTION_KINDS,
  MORNING_ROUTINE_INPUT_STATUSES,
  MORNING_ROUTINE_ITEM_SOURCES,
  MORNING_ROUTINE_LOCATION_KINDS,
  MORNING_ROUTINE_REVIEW_STATUSES,
} from "./morning-routine";

export const morningRoutineItemSourceSchema = z.enum(
  MORNING_ROUTINE_ITEM_SOURCES,
);
export const morningRoutineActionKindSchema = z.enum(
  MORNING_ROUTINE_ACTION_KINDS,
);
export const morningRoutineLocationKindSchema = z.enum(
  MORNING_ROUTINE_LOCATION_KINDS,
);
export const morningRoutineInputStatusSchema = z.enum(
  MORNING_ROUTINE_INPUT_STATUSES,
);
export const morningRoutineReviewStatusSchema = z.enum(
  MORNING_ROUTINE_REVIEW_STATUSES,
);

export const persistMorningRoutineSelectionInputSchema = z.object({
  retailerId: z.string().uuid(),
  customerId: z.string().uuid(),
  forDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "forDate must be YYYY-MM-DD"),
  summary: z.string().trim().min(1).max(2000),
  provenance: z.object({
    personalizationConsent: z.enum(["granted", "denied", "withdrawn"]),
    locationConsent: z.enum(["granted", "denied", "withdrawn"]),
    personalizationStatus: morningRoutineInputStatusSchema,
    locationStatus: morningRoutineInputStatusSchema,
    locationKind: morningRoutineLocationKindSchema,
    locationLabel: z.string().trim().min(1).max(200).optional(),
    weatherStatus: morningRoutineInputStatusSchema,
    weatherSummary: z.string().trim().min(1).max(200).optional(),
    calendarStatus: morningRoutineInputStatusSchema,
    occasionLabels: z.array(z.string().trim().min(1).max(200)).max(20),
  }),
  recommendations: z
    .array(
      z.object({
        rank: z.number().int().min(1).max(50),
        source: morningRoutineItemSourceSchema,
        displayName: z.string().trim().min(1).max(200),
        categoryCode: z.string().trim().min(1).max(40).optional(),
        score: z.number(),
        wardrobeItemId: z.string().uuid().optional(),
        productId: z.string().uuid().optional(),
        productVariantId: z.string().uuid().optional(),
        productSlug: z.string().trim().min(1).max(200).optional(),
        primaryImageUrl: z.string().trim().min(1).max(2000).optional(),
        explanation: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
        factors: z
          .array(
            z.object({
              code: z.string().trim().min(1).max(40),
              detail: z.string().trim().min(1).max(500),
            }),
          )
          .min(1)
          .max(20),
        actions: z
          .array(
            z.object({
              kind: morningRoutineActionKindSchema,
              available: z.boolean(),
              reason: z.string().trim().min(1).max(500).optional(),
              href: z.string().trim().min(1).max(500).optional(),
              productId: z.string().uuid().optional(),
              productVariantId: z.string().uuid().optional(),
              wardrobeItemId: z.string().uuid().optional(),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .max(20),
});

export type PersistMorningRoutineSelectionInput = z.infer<
  typeof persistMorningRoutineSelectionInputSchema
>;

export const morningRoutineActionInputSchema = z.object({
  selectionId: z.string().uuid(),
  recommendationId: z.string().uuid().optional(),
  action: morningRoutineActionKindSchema,
  productVariantId: z.string().uuid().optional(),
  retailerId: z.string().uuid(),
  reviewNote: z.string().trim().max(2000).optional(),
});

export type MorningRoutineActionInput = z.infer<
  typeof morningRoutineActionInputSchema
>;

export const generateMorningRoutineInputSchema = z.object({
  retailerId: z.string().uuid(),
  customerId: z.string().uuid(),
  forDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "forDate must be YYYY-MM-DD")
    .optional(),
  occasionLabel: z.string().trim().min(1).max(200).optional(),
});

export type GenerateMorningRoutineInput = z.infer<
  typeof generateMorningRoutineInputSchema
>;
