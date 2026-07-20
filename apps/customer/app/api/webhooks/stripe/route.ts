import {
  PaymentRepository,
  RetailerStripeAccountRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import {
  parseStripeConnectEvent,
  verifyWebhookSignature,
  type Stripe,
} from "@paon/payments";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Stripe Connect events only (every charge is a direct charge on a
 * retailer's connected account, never the platform account — see
 * docs/DECISIONS.md ADR-030) — registered against the Connect webhook
 * subscription in the Stripe dashboard, signed with
 * `STRIPE_CONNECT_WEBHOOK_SECRET`. Verifies the signature before doing
 * anything else, then delegates entirely to `parseStripeConnectEvent`
 * (`@paon/payments`, unit-tested) and repository calls — never inlines
 * business logic here (docs/API.md "Route Handlers").
 */
export async function POST(request: Request): Promise<Response> {
  const stripe = getStripeClient();
  const webhookSecret = env.stripeConnectWebhookSecret;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhooks are not configured on this deployment." },
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

  const supabase = getSupabaseAdminClient();
  const paymentRepo = new PaymentRepository(supabase);
  const accountRepo = new RetailerStripeAccountRepository(supabase);
  const action = parseStripeConnectEvent(event);

  try {
    switch (action.kind) {
      case "record_payment":
        await paymentRepo.recordStripeEvent({
          eventId: event.id,
          eventType: event.type,
          orderId: asId<"OrderId">(action.orderId),
          providerPaymentIntentId: action.providerPaymentIntentId,
          amountMinorUnits: action.amountMinorUnits,
          currency: action.currency,
          status: action.status,
          platformFeeAmountMinorUnits: action.platformFeeAmountMinorUnits,
        });
        break;
      case "record_refund": {
        const existing = await paymentRepo.findByProviderReference(
          action.providerPaymentIntentId,
        );
        if (existing) {
          await paymentRepo.recordStripeEvent({
            eventId: event.id,
            eventType: event.type,
            orderId: existing.orderId,
            providerPaymentIntentId: action.providerPaymentIntentId,
            amountMinorUnits: action.amountMinorUnits,
            currency: action.currency,
            status: "refunded",
            platformFeeAmountMinorUnits: existing.platformFee.amountMinorUnits,
          });
        }
        break;
      }
      case "sync_account":
        await accountRepo.syncCapabilities(action.stripeAccountId, {
          chargesEnabled: action.chargesEnabled,
          payoutsEnabled: action.payoutsEnabled,
          detailsSubmitted: action.detailsSubmitted,
        });
        break;
      case "ignored":
        break;
    }
  } catch (error) {
    // A non-2xx makes Stripe retry the delivery — anything other than a
    // deliberately-recognized case above should retry, not silently drop.
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
