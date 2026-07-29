import { z } from "zod";

import { WARDROBE_LIFECYCLE_EVENT_KINDS } from "./lifecycle";
import { WARDROBE_FIT_PERCEPTIONS } from "./wardrobe";

export const wardrobeLifecycleEventKindSchema = z.enum(
  WARDROBE_LIFECYCLE_EVENT_KINDS,
);

export const logWardrobeLifecycleEventInputSchema = z.object({
  wardrobeItemId: z.string().uuid(),
  eventKind: wardrobeLifecycleEventKindSchema,
  note: z.string().trim().max(500).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

export type LogWardrobeLifecycleEventInput = z.infer<
  typeof logWardrobeLifecycleEventInputSchema
>;

export const dismissWardrobeGuidanceInputSchema = z.object({
  wardrobeItemId: z.string().uuid(),
  guidanceKey: z.string().trim().min(1).max(200),
});

export type DismissWardrobeGuidanceInput = z.infer<
  typeof dismissWardrobeGuidanceInputSchema
>;

const selfScanMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const submitWardrobeSelfScanInputSchema = z.object({
  wardrobeItemId: z.string().uuid(),
  notes: z.string().trim().max(2000).optional(),
  fitPerception: z.enum(WARDROBE_FIT_PERCEPTIONS).optional(),
  fileName: z.string().trim().min(1).max(255).optional(),
  mimeType: z.enum(selfScanMimeTypes).optional(),
  sizeBytes: z.number().int().min(1).max(10_485_760).optional(),
});

export type SubmitWardrobeSelfScanInput = z.infer<
  typeof submitWardrobeSelfScanInputSchema
>;
