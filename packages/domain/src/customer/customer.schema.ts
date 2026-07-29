import { z } from "zod";

import { currencyCodeSchema } from "../retailer/retailer.schema";

import type { CustomerLifecycleStage, CustomerPreferences } from "./customer";

export const CUSTOMER_LIFECYCLE_STAGES = [
  "prospect",
  "first_purchase",
  "returning",
  "vip",
  "lapsed",
] as const satisfies readonly CustomerLifecycleStage[];

export const customerLifecycleStageSchema = z.enum(CUSTOMER_LIFECYCLE_STAGES);

export const CUSTOMER_LIFECYCLE_STAGE_LABELS: Record<
  CustomerLifecycleStage,
  string
> = {
  prospect: "New acquaintance",
  first_purchase: "First commission",
  returning: "Returning client",
  vip: "Private client",
  lapsed: "Quiet for a while",
};

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

export const COMMUNICATION_CHANNELS = [
  "email",
  "sms",
  "push",
  "in_app",
] as const satisfies readonly CustomerPreferences["communicationChannels"][number][];

export const communicationChannelSchema = z.enum(COMMUNICATION_CHANNELS);

/**
 * A shopper editing their own preferences from Customer Portal — every
 * field has a sensible default so a first save (no row exists yet) and a
 * later edit (row exists) use the same input shape; the repository
 * upserts on `customerId`, which this schema never accepts from the
 * client (derived server-side from the caller's session).
 */
export const upsertCustomerPreferencesInputSchema = z.object({
  preferredLocale: z.string().trim().min(2).max(10).default("en-US"),
  preferredCurrency: currencyCodeSchema.default("USD"),
  communicationChannels: z.array(communicationChannelSchema).default(["email"]),
  styleNotes: z.string().trim().max(2000).optional(),
  marketingOptIn: z.boolean().default(false),
  personalizationOptIn: z.boolean().default(false),
  locationOptIn: z.boolean().default(false),
});

export type UpsertCustomerPreferencesInput = z.infer<
  typeof upsertCustomerPreferencesInputSchema
>;
