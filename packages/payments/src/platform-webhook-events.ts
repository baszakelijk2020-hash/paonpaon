import type Stripe from "stripe";

import { toCreatedSubscription } from "./billing";

/**
 * Pure event → intent mapping for PAON's own platform Stripe account
 * (retailer subscriptions), distinct from `webhook-events.ts`'s Connect
 * events (customer payments on a retailer's connected account) — same
 * "no I/O, fully unit-testable" shape.
 */
export type StripePlatformWebhookAction =
  | {
      kind: "sync_subscription";
      providerSubscriptionId: string;
      status: Stripe.Subscription.Status;
      currentPeriodStart?: string;
      currentPeriodEnd?: string;
      cancelAtPeriodEnd: boolean;
      trialEndsAt?: string;
    }
  | { kind: "ignored" };

export function parseStripePlatformEvent(
  event: Stripe.Event,
): StripePlatformWebhookAction {
  switch (event.type) {
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      return {
        kind: "sync_subscription",
        ...toCreatedSubscription(subscription),
      };
    }
    default:
      return { kind: "ignored" };
  }
}
