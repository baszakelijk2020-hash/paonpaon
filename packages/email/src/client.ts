import { Resend } from "resend";

/**
 * Takes the API key as an explicit parameter rather than reading
 * `process.env` itself — same shape as `createSupabaseAdminClient`
 * (`@paon/database`) and `createStripeClient` (`@paon/payments`), so
 * every credential stays owned by the calling app's own `lib/env.ts`.
 */
export function createResendClient(apiKey: string): Resend {
  return new Resend(apiKey);
}
