import { z } from "zod";

import type { AppointmentStatus, AppointmentType } from "./appointment";

export const APPOINTMENT_TYPES = [
  "styling_consultation",
  "fitting",
  "alteration_fitting",
  "personal_shopping",
  "event",
] as const satisfies readonly AppointmentType[];

export const appointmentTypeSchema = z.enum(APPOINTMENT_TYPES);

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  styling_consultation: "Styling consultation",
  fitting: "Fitting",
  alteration_fitting: "Alteration fitting",
  personal_shopping: "Personal shopping",
  event: "In-store event",
};

export const APPOINTMENT_STATUSES = [
  "requested",
  "confirmed",
  "checked_in",
  "completed",
  "canceled",
  "no_show",
] as const satisfies readonly AppointmentStatus[];

export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  canceled: "Cancelled",
  no_show: "No show",
};

/**
 * What a Customer Portal appointment request needs — mirrors
 * `placeOrderInputSchema`'s shape (docs/DECISIONS.md ADR-014): the
 * retailer and everything about the slot come from the client, but
 * which `Customer` row it belongs to is always re-derived server-side
 * inside `request_appointment`, never trusted from the caller.
 */
export const requestAppointmentInputSchema = z.object({
  retailerId: z.string().uuid(),
  type: appointmentTypeSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  notes: z.string().trim().max(2000).optional(),
});

export type RequestAppointmentInput = z.infer<
  typeof requestAppointmentInputSchema
>;

/**
 * Retailer Portal: staff booking an appointment directly for an
 * existing customer (e.g. a walk-in) — unlike
 * `requestAppointmentInputSchema`, `customerId` is supplied directly
 * rather than re-derived, since the caller is trusted staff choosing
 * from their own retailer's customer list, not a customer asserting
 * their own identity.
 */
export const createAppointmentInputSchema = z.object({
  customerId: z.string().uuid(),
  type: appointmentTypeSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  staffId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateAppointmentInput = z.infer<
  typeof createAppointmentInputSchema
>;

/** Retailer Portal: confirm, reassign, check in, complete, cancel, no-show. */
export const updateAppointmentInputSchema = z.object({
  status: appointmentStatusSchema.optional(),
  staffId: z.string().uuid().optional(),
});

export type UpdateAppointmentInput = z.infer<
  typeof updateAppointmentInputSchema
>;

const timeOfDayPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createAvailabilityWindowInputSchema = z
  .object({
    staffId: z.string().uuid(),
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(timeOfDayPattern, "Use HH:MM (24-hour)"),
    endTime: z.string().regex(timeOfDayPattern, "Use HH:MM (24-hour)"),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "Start time must be before end time",
    path: ["endTime"],
  });

export type CreateAvailabilityWindowInput = z.infer<
  typeof createAvailabilityWindowInputSchema
>;
