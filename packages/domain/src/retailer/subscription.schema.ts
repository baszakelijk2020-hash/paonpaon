import { z } from "zod";

import { COMMERCIAL_FEATURE_KEYS } from "./subscription";

/**
 * PAON Admin assigns a plan to a retailer — everything else (Stripe
 * customer/subscription creation, period dates, status) is derived
 * server-side, never trusted from the client. See docs/DECISIONS.md
 * ADR-031.
 */
export const assignSubscriptionPlanInputSchema = z.object({
  retailerId: z.string().uuid(),
  planId: z.string().uuid(),
});

export type AssignSubscriptionPlanInput = z.infer<
  typeof assignSubscriptionPlanInputSchema
>;

/** Platform-staff-only — records the real Stripe Price id once created in the Stripe dashboard (see docs/PROJECT_STATE.md "Credentials needed"). */
export const updateSubscriptionPlanPriceInputSchema = z.object({
  planId: z.string().uuid(),
  providerPriceId: z.string().trim().min(1).max(200),
});

export type UpdateSubscriptionPlanPriceInput = z.infer<
  typeof updateSubscriptionPlanPriceInputSchema
>;

export const updateCommercialPlanInputSchema = z.object({
  planId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  positioning: z.string().trim().min(5).max(240),
  description: z.string().trim().min(10).max(1000),
  priceAmountMinorUnits: z.coerce.number().int().min(0).max(100_000_000),
  priceCurrency: z.enum([
    "USD",
    "EUR",
    "GBP",
    "CHF",
    "JPY",
    "AED",
    "HKD",
    "SGD",
  ]),
  priceIsFrom: z.coerce.boolean(),
  implementationFeeAmountMinorUnits: z.coerce
    .number()
    .int()
    .min(0)
    .max(100_000_000),
  implementationFeeCurrency: z.enum([
    "USD",
    "EUR",
    "GBP",
    "CHF",
    "JPY",
    "AED",
    "HKD",
    "SGD",
  ]),
  seatLimit: z
    .union([z.coerce.number().int().positive().max(100_000), z.literal("")])
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  includedFeatureKeys: z.array(z.enum(COMMERCIAL_FEATURE_KEYS)).min(1),
  isPublic: z.coerce.boolean(),
});

export type UpdateCommercialPlanInput = z.infer<
  typeof updateCommercialPlanInputSchema
>;
