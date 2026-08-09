import { z } from "zod";

import {
  FIT_ARCHETYPE_SLUGS,
  STYLE_PORTRAIT_REFERENCE_KINDS,
  VISUAL_PRESET_BACKGROUND_TYPES,
  WARDROBE_VISUALIZATION_FEEDBACK_SIGNALS,
} from "./virtual-studio";

const optionalUuid = z.string().uuid().optional();
const optionalNotes = z.string().trim().max(2000).optional();

export const fitArchetypeSlugSchema = z.enum(FIT_ARCHETYPE_SLUGS);
export const stylePortraitReferenceKindSchema = z.enum(
  STYLE_PORTRAIT_REFERENCE_KINDS,
);
export const visualPresetBackgroundTypeSchema = z.enum(
  VISUAL_PRESET_BACKGROUND_TYPES,
);
export const wardrobeVisualizationFeedbackSignalSchema = z.enum(
  WARDROBE_VISUALIZATION_FEEDBACK_SIGNALS,
);

export const createStylePortraitInputSchema = z.object({
  retailerId: z.string().uuid(),
  customerId: z.string().uuid(),
  fitArchetypeConceptId: optionalUuid,
  references: z
    .array(
      z.object({
        kind: stylePortraitReferenceKindSchema,
        storageBucket: z.string().trim().min(1).max(200),
        storagePath: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(8),
});

export type CreateStylePortraitInput = z.infer<
  typeof createStylePortraitInputSchema
>;

export const createRetailerVisualPresetInputSchema = z.object({
  retailerId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  isDefault: z.boolean().default(false),
  backgroundType: visualPresetBackgroundTypeSchema,
  backgroundImageUrl: z.string().url().max(2000).optional(),
  poseFamily: z.string().trim().min(1).max(120),
  cameraHeight: z.string().trim().min(1).max(120),
  cameraDistance: z.string().trim().min(1).max(120),
  crop: z.string().trim().min(1).max(120),
  aspectRatio: z.string().trim().min(1).max(20),
  lighting: z.string().trim().min(1).max(120),
  expression: z.string().trim().min(1).max(120),
  visualTreatment: z.string().trim().min(1).max(500),
  negativeConstraints: z.array(z.string().trim().min(1).max(200)).max(20),
});

export type CreateRetailerVisualPresetInput = z.infer<
  typeof createRetailerVisualPresetInputSchema
>;

export const enqueueWardrobeVisualizationJobInputSchema = z.object({
  retailerId: z.string().uuid(),
  customerId: z.string().uuid(),
  outfitId: z.string().uuid(),
  stylePortraitId: z.string().uuid(),
  retailerVisualPresetId: z.string().uuid(),
  writtenInstructions: z.string().trim().max(1000).optional(),
});

export type EnqueueWardrobeVisualizationJobInput = z.infer<
  typeof enqueueWardrobeVisualizationJobInputSchema
>;

export const enqueueStylePortraitPreviewJobInputSchema = z.object({
  retailerId: z.string().uuid(),
  customerId: z.string().uuid(),
  stylePortraitId: z.string().uuid(),
  retailerVisualPresetId: z.string().uuid(),
});

export type EnqueueStylePortraitPreviewJobInput = z.infer<
  typeof enqueueStylePortraitPreviewJobInputSchema
>;

export const recordWardrobeVisualizationFeedbackInputSchema = z.object({
  retailerId: z.string().uuid(),
  customerId: z.string().uuid(),
  jobId: z.string().uuid(),
  signal: wardrobeVisualizationFeedbackSignalSchema,
  note: optionalNotes,
});

export type RecordWardrobeVisualizationFeedbackInput = z.infer<
  typeof recordWardrobeVisualizationFeedbackInputSchema
>;
