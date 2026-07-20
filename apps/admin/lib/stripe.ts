import "server-only";

import { createStripeClient, type Stripe } from "@paon/payments";

import { env } from "./env";

/**
 * Returns `null`, not a throw, when `STRIPE_SECRET_KEY` isn't
 * configured — callers render a "not configured" state rather than
 * crashing. Only `@paon/payments` lists `stripe` as a real dependency
 * (ADR-001's "never import a provider SDK type directly outside its
 * wrapping package" shape).
 */
export function getStripeClient(): Stripe | null {
  const secretKey = env.stripeSecretKey;
  return secretKey ? createStripeClient(secretKey) : null;
}
