import type Stripe from "stripe";

/**
 * Thin wrapper so every webhook Route Handler in every app verifies
 * signatures the same way — `stripe.webhooks.constructEvent` throws on
 * an invalid/missing signature, which the caller must catch and turn
 * into a 400 before touching anything else (docs/API.md "Webhooks").
 */
export function verifyWebhookSignature(
  stripe: Stripe,
  payload: string | Buffer,
  signatureHeader: string,
  webhookSecret: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signatureHeader,
    webhookSecret,
  );
}
