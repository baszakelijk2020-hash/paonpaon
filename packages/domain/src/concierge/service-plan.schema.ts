import { z } from "zod";

import { CURRENCY_CODES } from "../retailer/retailer.schema";

import {
  SERVICE_BOOKING_KINDS,
  SERVICE_BOOKING_STATUSES,
  SERVICE_CARE_KINDS,
  SERVICE_ENTITLEMENT_KINDS,
  SERVICE_FULFILMENT_METHODS,
  SERVICE_FULFILMENT_STATUSES,
  SERVICE_KINDS,
  SERVICE_MEMBERSHIP_STATUSES,
  SERVICE_PLAN_STATUSES,
} from "./service-plan";

const uuidSchema = z.string().uuid();

export const serviceKindSchema = z.enum(SERVICE_KINDS);
export const servicePlanStatusSchema = z.enum(SERVICE_PLAN_STATUSES);
export const serviceMembershipStatusSchema = z.enum(
  SERVICE_MEMBERSHIP_STATUSES,
);
export const serviceEntitlementKindSchema = z.enum(SERVICE_ENTITLEMENT_KINDS);
export const serviceBookingKindSchema = z.enum(SERVICE_BOOKING_KINDS);
export const serviceBookingStatusSchema = z.enum(SERVICE_BOOKING_STATUSES);
export const serviceFulfilmentMethodSchema = z.enum(SERVICE_FULFILMENT_METHODS);
export const serviceFulfilmentStatusSchema = z.enum(
  SERVICE_FULFILMENT_STATUSES,
);
export const serviceCareKindSchema = z.enum(SERVICE_CARE_KINDS);

export const upsertServicePlanInputSchema = z.object({
  planId: uuidSchema.optional(),
  kind: serviceKindSchema,
  status: servicePlanStatusSchema.default("draft"),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(500),
  explanation: z.string().trim().min(1).max(500),
});

export type UpsertServicePlanInput = z.infer<
  typeof upsertServicePlanInputSchema
>;

export const enrollServiceMembershipInputSchema = z.object({
  planId: uuidSchema,
  customerId: uuidSchema,
  advisorStaffId: uuidSchema.optional(),
  commitmentNotes: z.string().trim().min(1).max(1000).optional(),
  seedDefaultEntitlements: z.boolean().default(true),
});

export type EnrollServiceMembershipInput = z.infer<
  typeof enrollServiceMembershipInputSchema
>;

export const setServiceMembershipStatusInputSchema = z.object({
  membershipId: uuidSchema,
  status: serviceMembershipStatusSchema,
});

export type SetServiceMembershipStatusInput = z.infer<
  typeof setServiceMembershipStatusInputSchema
>;

export const assignServiceAdvisorInputSchema = z.object({
  membershipId: uuidSchema,
  advisorStaffId: uuidSchema,
});

export type AssignServiceAdvisorInput = z.infer<
  typeof assignServiceAdvisorInputSchema
>;

export const grantServiceEntitlementInputSchema = z.object({
  membershipId: uuidSchema,
  kind: serviceEntitlementKindSchema,
  quantity: z.coerce.number().int().positive().max(100),
  idempotencyKey: z.string().trim().min(1).max(200),
  notes: z.string().trim().min(1).max(500).optional(),
});

export type GrantServiceEntitlementInput = z.infer<
  typeof grantServiceEntitlementInputSchema
>;

export const requestServiceBookingInputSchema = z.object({
  membershipId: uuidSchema,
  kind: serviceBookingKindSchema,
  requestedFor: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().min(1).max(1000).optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
});

export type RequestServiceBookingInput = z.infer<
  typeof requestServiceBookingInputSchema
>;

export const transitionServiceBookingInputSchema = z.object({
  bookingId: uuidSchema,
  status: serviceBookingStatusSchema,
  commitmentNotes: z.string().trim().min(1).max(1000).optional(),
  consumeEntitlement: z.boolean().default(true),
});

export type TransitionServiceBookingInput = z.infer<
  typeof transitionServiceBookingInputSchema
>;

export const linkServiceBookingAppointmentInputSchema = z.object({
  bookingId: uuidSchema,
  appointmentId: uuidSchema,
});

export type LinkServiceBookingAppointmentInput = z.infer<
  typeof linkServiceBookingAppointmentInputSchema
>;

export const recordServiceFulfilmentInputSchema = z.object({
  bookingId: uuidSchema,
  method: serviceFulfilmentMethodSchema,
  status: serviceFulfilmentStatusSchema.default("scheduled"),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().min(1).max(1000).optional(),
});

export type RecordServiceFulfilmentInput = z.infer<
  typeof recordServiceFulfilmentInputSchema
>;

export const recordServiceCareInputSchema = z.object({
  membershipId: uuidSchema,
  careKind: serviceCareKindSchema,
  summary: z.string().trim().min(1).max(500),
  bookingId: uuidSchema.optional(),
  wardrobeItemId: uuidSchema.optional(),
  physicalGarmentId: uuidSchema.optional(),
  alterationId: uuidSchema.optional(),
});

export type RecordServiceCareInput = z.infer<
  typeof recordServiceCareInputSchema
>;

export const recordServiceCostInputSchema = z.object({
  membershipId: uuidSchema,
  label: z.string().trim().min(1).max(120),
  amountMinorUnits: z.coerce.number().int().nonnegative().max(100_000_000),
  currency: z.enum(CURRENCY_CODES),
  bookingId: uuidSchema.optional(),
  notes: z.string().trim().min(1).max(500).optional(),
});

export type RecordServiceCostInput = z.infer<
  typeof recordServiceCostInputSchema
>;
