import Stripe from "stripe";

/**
 * Takes the secret key as an explicit parameter rather than reading
 * `process.env` itself, so this package stays usable from any server
 * runtime and every credential stays owned by the calling app's own
 * `lib/env.ts` — same shape as `createSupabaseAdminClient`
 * (`@paon/database`).
 */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });
}
