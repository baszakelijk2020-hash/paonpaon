import { z } from "zod";

import type { PaymentProvider, PaymentStatus } from "./payment";

export const PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "captured",
  "refunded",
  "failed",
] as const satisfies readonly PaymentStatus[];

export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);

export const PAYMENT_PROVIDERS = [
  "stripe",
] as const satisfies readonly PaymentProvider[];

export const paymentProviderSchema = z.enum(PAYMENT_PROVIDERS);

/**
 * What a Customer Portal "pay now" submission needs — everything else
 * (amount, currency, connected account, platform fee) is re-derived
 * server-side from the order and the retailer's `RetailerStripeAccount`,
 * never trusted from the client. See docs/DECISIONS.md ADR-030.
 */
export const createCheckoutSessionInputSchema = z.object({
  orderId: z.string().uuid(),
});

export type CreateCheckoutSessionInput = z.infer<
  typeof createCheckoutSessionInputSchema
>;

/** Platform-staff-only — see `RetailerStripeAccount.platformFeeBasisPoints`. */
export const updatePlatformFeeInputSchema = z.object({
  retailerId: z.string().uuid(),
  platformFeeBasisPoints: z.coerce.number().int().min(0).max(10000),
});

export type UpdatePlatformFeeInput = z.infer<
  typeof updatePlatformFeeInputSchema
>;
