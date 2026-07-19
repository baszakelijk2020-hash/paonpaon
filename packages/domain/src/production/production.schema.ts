import { z } from "zod";

import type {
  AlterationStatus,
  AlterationTaskStatus,
  GarmentSourceKind,
  WorkClassification,
} from "./production";
import { GARMENT_CATEGORIES } from "./production";

export const ALTERATION_STATUSES = [
  "intake",
  "quoted",
  "awaiting_approval",
  "approved",
  "assigned",
  "in_progress",
  "completion_review",
  "ready_for_pickup",
  "out_for_delivery",
  "completed",
  "canceled",
] as const satisfies readonly AlterationStatus[];

export const ALTERATION_TASK_STATUSES = [
  "proposed",
  "approved",
  "assigned",
  "in_progress",
  "review_ready",
  "completed",
  "canceled",
] as const satisfies readonly AlterationTaskStatus[];

export const WORK_CLASSIFICATIONS = [
  "work_now",
  "future_order_note",
] as const satisfies readonly WorkClassification[];

export const GARMENT_SOURCE_KINDS = [
  "external",
  "finished_mtm",
] as const satisfies readonly GarmentSourceKind[];

export const alterationStatusSchema = z.enum(ALTERATION_STATUSES);
export const alterationTaskStatusSchema = z.enum(ALTERATION_TASK_STATUSES);
export const workClassificationSchema = z.enum(WORK_CLASSIFICATIONS);
export const garmentSourceKindSchema = z.enum(GARMENT_SOURCE_KINDS);
export const garmentCategorySchema = z.enum(GARMENT_CATEGORIES);

const intakeTaskSchema = z.object({
  operationId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(160),
  instructions: z.string().trim().max(2000).optional(),
  classification: workClassificationSchema,
});

const intakeObservationSchema = z.object({
  area: z.string().trim().min(2).max(120),
  observation: z.string().trim().min(2).max(2000),
  classification: workClassificationSchema,
});

export const createAlterationInputSchema = z
  .object({
    customerId: z.string().uuid(),
    appointmentId: z.string().uuid().optional(),
    sourceKind: garmentSourceKindSchema,
    categoryCode: garmentCategorySchema,
    garmentType: z.string().trim().min(2).max(120),
    brand: z.string().trim().max(120).optional(),
    description: z.string().trim().min(2).max(1000),
    identifyingPhotoUrl: z.string().trim().url().optional(),
    labelMetadata: z.record(z.string(), z.string().trim().min(1)).default({}),
    intakeCondition: z.string().trim().min(2).max(1000),
    externalReference: z.string().trim().max(160).optional(),
    orderLineId: z.string().uuid().optional(),
    supplierOrderReference: z.string().trim().max(160).optional(),
    dueDate: z.string().date().optional(),
    observations: z.array(intakeObservationSchema).min(1).max(20),
    tasks: z.array(intakeTaskSchema).min(1).max(30),
  })
  .superRefine((value, context) => {
    if (
      value.sourceKind === "finished_mtm" &&
      !value.orderLineId &&
      !value.supplierOrderReference
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supplierOrderReference"],
        message: "Link a PAON order line or enter a supplier/order reference.",
      });
    }
    if (!value.tasks.some((task) => task.classification === "work_now")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tasks"],
        message: "A work order needs at least one work-now task.",
      });
    }
  });

export type CreateAlterationInput = z.infer<typeof createAlterationInputSchema>;

export const addAlterationUpdateInputSchema = z.object({
  status: alterationStatusSchema,
  note: z.string().trim().max(2000).optional(),
  customerVisible: z.boolean().default(false),
});

export type AddAlterationUpdateInput = z.infer<
  typeof addAlterationUpdateInputSchema
>;

export const proposePriceChangeInputSchema = z.object({
  taskId: z.string().uuid().optional(),
  proposedAmountMinorUnits: z.number().int().min(0).max(100_000_000),
  explanation: z.string().trim().min(10).max(2000),
  evidenceAttachmentId: z.string().uuid().optional(),
});

export const decidePriceChangeInputSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(3).max(2000),
});

export const recordCustodyEventInputSchema = z
  .object({
    eventType: z.enum([
      "received",
      "handed_to_workshop",
      "returned_to_retailer",
      "released_to_customer",
      "delivery_dispatch",
      "delivery_complete",
    ]),
    fromParty: z.string().trim().max(160).optional(),
    toParty: z.string().trim().max(160).optional(),
    conditionNote: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (
      ["released_to_customer", "delivery_complete"].includes(value.eventType) &&
      !value.toParty
    ) {
      context.addIssue({
        code: "custom",
        path: ["toParty"],
        message: "The recipient is required for release or delivery.",
      });
    }
  });

export const recordFulfillmentInputSchema = z
  .object({
    method: z.enum(["pickup", "delivery"]),
    status: z.enum([
      "scheduled",
      "ready",
      "dispatched",
      "completed",
      "canceled",
    ]),
    scheduledAt: z.string().datetime().optional(),
    deliveryAddress: z
      .object({
        line1: z.string().trim().min(1).max(200),
        line2: z.string().trim().max(200).optional(),
        city: z.string().trim().min(1).max(120),
        region: z.string().trim().max(120).optional(),
        postalCode: z.string().trim().min(1).max(32),
        countryCode: z.string().trim().length(2).toUpperCase(),
      })
      .optional(),
    releasedToName: z.string().trim().max(160).optional(),
    verificationNote: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.method === "delivery" &&
      value.status !== "canceled" &&
      !value.deliveryAddress
    ) {
      context.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "A delivery address is required for delivery fulfillment.",
      });
    }
    if (value.status === "completed" && !value.releasedToName) {
      context.addIssue({
        code: "custom",
        path: ["releasedToName"],
        message: "The recipient is required to complete fulfillment.",
      });
    }
    if (value.status === "completed" && !value.verificationNote) {
      context.addIssue({
        code: "custom",
        path: ["verificationNote"],
        message: "A verification note is required to complete fulfillment.",
      });
    }
  });
