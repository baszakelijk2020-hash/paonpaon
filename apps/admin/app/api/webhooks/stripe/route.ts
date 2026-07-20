import { RetailerSubscriptionRepository } from "@paon/database";
import {
  parseStripePlatformEvent,
  verifyWebhookSignature,
  type Stripe,
} from "@paon/payments";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * PAON's own platform Stripe account events (retailer subscriptions) —
 * distinct from apps/customer's Connect webhook (customer payments on
 * a retailer's connected account). Verifies the signature before doing
 * anything else, then delegates entirely to `parseStripePlatformEvent`
 * (`@paon/payments`, unit-tested) and `RetailerSubscriptionRepository`
 * — never inlines business logic here (docs/API.md "Route Handlers").
 */
export async function POST(request: Request): Promise<Response> {
  const stripe = getStripeClient();
  const webhookSecret = env.stripeBillingWebhookSecret;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      {
        error: "Stripe billing webhooks are not configured on this deployment.",
      },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(stripe, payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid signature" },
      { status: 400 },
    );
  }

  const action = parseStripePlatformEvent(event);

  try {
    if (action.kind === "sync_subscription") {
      await new RetailerSubscriptionRepository(
        getSupabaseAdminClient(),
      ).syncFromWebhook(action.providerSubscriptionId, {
        status: action.status,
        cancelAtPeriodEnd: action.cancelAtPeriodEnd,
        ...(action.currentPeriodStart
          ? { currentPeriodStart: action.currentPeriodStart }
          : {}),
        ...(action.currentPeriodEnd
          ? { currentPeriodEnd: action.currentPeriodEnd }
          : {}),
        ...(action.trialEndsAt ? { trialEndsAt: action.trialEndsAt } : {}),
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Webhook processing failed",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
