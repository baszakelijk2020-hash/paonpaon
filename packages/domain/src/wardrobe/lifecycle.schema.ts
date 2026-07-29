import { z } from "zod";

import {
  FIT_FRESHNESS_STATUSES,
  LONGEVITY_GUIDANCE_KINDS,
  WARDROBE_ATTACHMENT_KINDS,
  WARDROBE_LIFECYCLE_EVENT_KINDS,
  WARDROBE_SELF_SCAN_PROVENANCE,
  WARDROBE_SERVICE_HANDOFF_KINDS,
  isSecureWardrobeEvidencePath,
  isWardrobeItemSelfScanEligible,
} from "./lifecycle";
import {
  WARDROBE_FIT_PERCEPTIONS,
  type WardrobeFitPerception,
  type WardrobeItem,
} from "./wardrobe";

export const wardrobeLifecycleEventKindSchema = z.enum(
  WARDROBE_LIFECYCLE_EVENT_KINDS,
);
export const wardrobeAttachmentKindSchema = z.enum(WARDROBE_ATTACHMENT_KINDS);
export const wardrobeServiceHandoffKindSchema = z.enum(
  WARDROBE_SERVICE_HANDOFF_KINDS,
);
export const fitFreshnessStatusSchema = z.enum(FIT_FRESHNESS_STATUSES);
export const longevityGuidanceKindSchema = z.enum(LONGEVITY_GUIDANCE_KINDS);
export const wardrobeSelfScanProvenanceSchema = z.literal(
  WARDROBE_SELF_SCAN_PROVENANCE,
);

const optionalNotes = z.string().trim().max(2000).optional();
const fitPerceptionSchema = z.enum(WARDROBE_FIT_PERCEPTIONS);

export const recordWardrobeLifecycleEventInputSchema = z
  .object({
    wardrobeItemId: z.string().uuid(),
    eventKind: wardrobeLifecycleEventKindSchema,
    note: optionalNotes,
    guidanceKind: longevityGuidanceKindSchema.optional(),
    occurredAt: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.eventKind === "guidance_dismissed" && !value.guidanceKind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dismissed guidance requires a guidance kind.",
        path: ["guidanceKind"],
      });
    }
    if (value.eventKind !== "guidance_dismissed" && value.guidanceKind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Guidance kind is only valid when dismissing guidance.",
        path: ["guidanceKind"],
      });
    }
  });

export type RecordWardrobeLifecycleEventInput = z.infer<
  typeof recordWardrobeLifecycleEventInputSchema
>;

const fitServiceAppointmentTypes = ["fitting", "alteration_fitting"] as const;

export const submitWardrobeSelfScanInputSchema = z
  .object({
    wardrobeItemId: z.string().uuid(),
    notes: optionalNotes,
    sizeChangeReported: z.boolean().default(false),
    fitPerceptionAtScan: fitPerceptionSchema.optional(),
    requestServiceHandoff: z.boolean().default(true),
    appointmentStartsAt: z.string().datetime({ offset: true }).optional(),
    appointmentEndsAt: z.string().datetime({ offset: true }).optional(),
    preferredAppointmentType: z.enum(fitServiceAppointmentTypes).optional(),
  })
  .superRefine((value, ctx) => {
    const hasStart = value.appointmentStartsAt !== undefined;
    const hasEnd = value.appointmentEndsAt !== undefined;
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Appointment start and end must be provided together.",
        path: ["appointmentEndsAt"],
      });
    }
    if (
      hasStart &&
      hasEnd &&
      value.appointmentStartsAt !== undefined &&
      value.appointmentEndsAt !== undefined &&
      value.appointmentStartsAt >= value.appointmentEndsAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Appointment end must be after start.",
        path: ["appointmentEndsAt"],
      });
    }
  });

export type SubmitWardrobeSelfScanInput = z.infer<
  typeof submitWardrobeSelfScanInputSchema
>;

export const wardrobeAttachmentUploadMetaSchema = z
  .object({
    wardrobeItemId: z.string().uuid(),
    retailerId: z.string().uuid(),
    kind: wardrobeAttachmentKindSchema.default("self_scan"),
    storagePath: z.string().trim().min(1).max(1000),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z.number().int().positive().max(10_485_760),
  })
  .superRefine((value, ctx) => {
    if (
      !isSecureWardrobeEvidencePath({
        storagePath: value.storagePath,
        retailerId: value.retailerId,
        wardrobeItemId: value.wardrobeItemId,
      })
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Storage path must be retailerId/wardrobeItemId/… with no path traversal.",
        path: ["storagePath"],
      });
    }
  });

export type WardrobeAttachmentUploadMeta = z.infer<
  typeof wardrobeAttachmentUploadMetaSchema
>;

export function assertSelfScanEligibleItem(
  item: Pick<
    WardrobeItem,
    "condition" | "orderLineId" | "physicalGarmentId" | "ownershipKind"
  >,
): boolean {
  return isWardrobeItemSelfScanEligible(item);
}

export type { WardrobeFitPerception };
