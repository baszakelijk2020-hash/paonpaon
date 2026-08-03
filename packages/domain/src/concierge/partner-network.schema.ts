import { z } from "zod";

import { PARTNER_CAPABILITIES } from "./partner-network";

export const partnerCapabilitySchema = z.enum(PARTNER_CAPABILITIES);

export const createServicePartnerInputSchema = z.object({
  displayName: z.string().trim().min(2).max(200),
  capabilities: z.array(partnerCapabilitySchema).min(1),
  turnaroundDays: z.coerce.number().int().min(0).max(365),
  contactEmail: z.string().trim().email().max(320).optional(),
  contactPhone: z.string().trim().min(1).max(64).optional(),
});
export type CreateServicePartnerInput = z.infer<
  typeof createServicePartnerInputSchema
>;

export const createServicePartnerEngagementInputSchema = z.object({
  partnerId: z.string().uuid(),
  customerId: z.string().uuid(),
  wardrobeItemId: z.string().uuid(),
  jobReference: z.string().trim().min(1).max(64),
  capability: partnerCapabilitySchema,
  instructions: z.string().trim().min(1).max(4000),
  dueOn: z.string().date(),
});
export type CreateServicePartnerEngagementInput = z.infer<
  typeof createServicePartnerEngagementInputSchema
>;

export const createServicePartnerInvoiceInputSchema = z.object({
  partnerId: z.string().uuid(),
  partnerInvoiceReference: z.string().trim().min(1).max(120),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  currency: z.string().trim().length(3),
});
export type CreateServicePartnerInvoiceInput = z.infer<
  typeof createServicePartnerInvoiceInputSchema
>;

export const addServicePartnerInvoiceLineInputSchema = z.object({
  invoiceId: z.string().uuid(),
  jobReference: z.string().trim().min(1).max(64),
  amountMinorUnits: z.coerce.number().int().min(0),
});
export type AddServicePartnerInvoiceLineInput = z.infer<
  typeof addServicePartnerInvoiceLineInputSchema
>;
