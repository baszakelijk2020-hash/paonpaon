import { z } from "zod";

import type { CustomerLifecycleStage } from "./customer";

export const CUSTOMER_LIFECYCLE_STAGES = [
  "prospect",
  "first_purchase",
  "returning",
  "vip",
  "lapsed",
] as const satisfies readonly CustomerLifecycleStage[];

export const customerLifecycleStageSchema = z.enum(CUSTOMER_LIFECYCLE_STAGES);

/**
 * A Retailer Portal staff member creating a CRM record for a client —
 * not a Customer Portal signup (which never supplies these fields
 * directly; the customer's own account links to an existing record by
 * email via `link_my_customer_accounts`, see docs/DECISIONS.md
 * ADR-013).
 */
export const createCustomerInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().max(32).optional(),
  lifecycleStage: customerLifecycleStageSchema.default("prospect"),
  acquisitionSource: z.string().trim().max(120).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;

/**
 * `measurements` is validated as a flexible string-to-string map here —
 * the common-measurement-name inputs a form presents (chest, waist,
 * inseam, ...) are a UI convenience, assembled into this shape by the
 * Server Action before validation, not a fixed schema of named fields.
 * See `CustomerFitProfileEntry` for why.
 */
export const addFitProfileEntryInputSchema = z.object({
  measurements: z.record(z.string(), z.string().trim().min(1)),
  fitPreferences: z.string().trim().max(1000).optional(),
  styleNotes: z.string().trim().max(1000).optional(),
});

export type AddFitProfileEntryInput = z.infer<
  typeof addFitProfileEntryInputSchema
>;
