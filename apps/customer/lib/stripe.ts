import "server-only";

import { createStripeClient, type Stripe } from "@paon/payments";

import { env } from "./env";

/**
 * Returns `null`, not a throw, when `STRIPE_SECRET_KEY` isn't
 * configured — callers render a "payments not available yet" state
 * rather than crashing. Only `@paon/payments` lists `stripe` as a real
 * dependency — this app only ever sees the re-exported type (ADR-001's
 * "never import a provider SDK type directly outside its wrapping
 * package" shape, previously established for `@supabase/supabase-js`).
 */
export function getStripeClient(): Stripe | null {
  const secretKey = env.stripeSecretKey;
  return secretKey ? createStripeClient(secretKey) : null;
}
