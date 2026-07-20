import { z } from "zod";

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
