import { z } from "zod";

import {
  CONCIERGE_BOOKING_TRANSITIONS,
  CONCIERGE_ENROLLMENT_STATUSES,
  CONCIERGE_OPERATION_KINDS,
  CONCIERGE_SERVICE_KINDS,
} from "./concierge";

export const conciergeServiceKindSchema = z.enum(CONCIERGE_SERVICE_KINDS);
export const conciergeEnrollmentStatusSchema = z.enum(
  CONCIERGE_ENROLLMENT_STATUSES,
);
export const conciergeOperationKindSchema = z.enum(CONCIERGE_OPERATION_KINDS);
export const conciergeBookingTransitionSchema = z.enum(
  CONCIERGE_BOOKING_TRANSITIONS,
);

export const upsertConciergePlanDefinitionInputSchema = z.object({
  planDefinitionId: z.string().uuid().optional(),
  serviceKind: conciergeServiceKindSchema,
  label: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(500),
  active: z.boolean().default(true),
});

export type UpsertConciergePlanDefinitionInput = z.infer<
  typeof upsertConciergePlanDefinitionInputSchema
>;

export const enrollConciergeServiceInputSchema = z.object({
  customerId: z.string().uuid(),
  planDefinitionId: z.string().uuid(),
  advisorStaffId: z.string().uuid().optional(),
  commitmentNote: z.string().trim().min(1).max(500).optional(),
  status: conciergeEnrollmentStatusSchema.default("active"),
});

export type EnrollConciergeServiceInput = z.infer<
  typeof enrollConciergeServiceInputSchema
>;

export const requestConciergeBookingInputSchema = z
  .object({
    enrollmentId: z.string().uuid(),
    title: z.string().trim().min(1).max(120),
    notes: z.string().trim().min(1).max(500).optional(),
    wardrobeItemId: z.string().uuid().optional(),
    physicalGarmentId: z.string().uuid().optional(),
    operations: z
      .array(
        z.object({
          operationKind: conciergeOperationKindSchema,
          label: z.string().trim().min(1).max(120).optional(),
          notes: z.string().trim().min(1).max(300).optional(),
          wardrobeItemId: z.string().uuid().optional(),
          physicalGarmentId: z.string().uuid().optional(),
        }),
      )
      .min(1)
      .max(8),
  })
  .superRefine((value, ctx) => {
    if (value.operations.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one service operation is required.",
        path: ["operations"],
      });
    }
  });

export type RequestConciergeBookingInput = z.infer<
  typeof requestConciergeBookingInputSchema
>;

export const transitionConciergeBookingInputSchema = z.object({
  bookingId: z.string().uuid(),
  transition: conciergeBookingTransitionSchema,
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  note: z.string().trim().min(1).max(300).optional(),
});

export type TransitionConciergeBookingInput = z.infer<
  typeof transitionConciergeBookingInputSchema
>;

export const recordConciergeCostInputSchema = z.object({
  bookingId: z.string().uuid(),
  amountMinor: z.number().int().min(0).max(10_000_000),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  description: z.string().trim().min(1).max(300),
});

export type RecordConciergeCostInput = z.infer<
  typeof recordConciergeCostInputSchema
>;
