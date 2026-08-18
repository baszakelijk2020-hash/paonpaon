import { z } from "zod";

import { BRANCH_PRESENTATION_MODES } from "./retailer-branch";

export const branchPresentationModeSchema = z.enum(BRANCH_PRESENTATION_MODES);

export const branchOpeningHoursEntrySchema = z.object({
  day: z.enum([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]),
  closed: z.boolean(),
  opens: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  closes: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});

export const branchContactActionSchema = z.object({
  type: z.enum(["call", "email", "book", "directions"]),
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(300),
});

export const branchImageSchema = z.object({
  url: z.string().trim().url().max(1000),
  alt: z.string().trim().min(1).max(200),
  rightsNote: z.string().trim().max(500).optional(),
});

export const updateRetailerBranchLocationInputSchema = z.object({
  branchId: z.string().uuid(),
  storeType: z.string().trim().min(1).max(80).optional(),
  addressLine1: z.string().trim().min(1).max(200).optional(),
  addressLine2: z.string().trim().min(1).max(200).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  region: z.string().trim().min(1).max(120).optional(),
  postalCode: z.string().trim().min(1).max(32).optional(),
  country: z.string().trim().min(1).max(120).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phone: z.string().trim().min(1).max(40).optional(),
  contactEmail: z.string().trim().email().max(200).optional(),
  openingHours: z.array(branchOpeningHoursEntrySchema).default([]),
  services: z.array(z.string().trim().min(1).max(80)).default([]),
  contactActions: z.array(branchContactActionSchema).default([]),
  filterCategories: z.array(z.string().trim().min(1).max(60)).default([]),
  imagery: z.array(branchImageSchema).default([]),
  presentationMode: branchPresentationModeSchema.default("map"),
  published: z.boolean().default(false),
});
export type UpdateRetailerBranchLocationInput = z.infer<
  typeof updateRetailerBranchLocationInputSchema
>;
