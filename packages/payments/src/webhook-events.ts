import type Stripe from "stripe";

import { toAccountCapabilityStatus } from "./connect";

/**
 * Pure event → intent mapping, no I/O — what actually writes to the
 * database lives in `@paon/database` repositories, called by the thin
 * Route Handler (docs/API.md "Route Handlers": "delegate to a
 * repository/service, never inline business logic in the handler").
 * Keeping this pure is what makes it unit-testable with plain fixture
 * objects, no live Stripe account needed.
 */
export type StripeConnectWebhookAction =
  | {
      kind: "record_payment";
      orderId: string;
      providerPaymentIntentId: string;
      amountMinorUnits: number;
      currency: string;
      status: "captured" | "failed";
      platformFeeAmountMinorUnits: number;
    }
  | {
      kind: "record_refund";
      providerPaymentIntentId: string;
      amountMinorUnits: number;
      currency: string;
    }
  | {
      kind: "sync_account";
      stripeAccountId: string;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      detailsSubmitted: boolean;
    }
  | { kind: "ignored" };

export function parseStripeConnectEvent(
  event: Stripe.Event,
): StripeConnectWebhookAction {
  switch (event.type) {
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata["orderId"];
      if (!orderId) return { kind: "ignored" };
      return {
        kind: "record_payment",
        orderId,
        providerPaymentIntentId: intent.id,
        amountMinorUnits: intent.amount,
        currency: intent.currency.toUpperCase(),
        status:
          event.type === "payment_intent.succeeded" ? "captured" : "failed",
        platformFeeAmountMinorUnits: intent.application_fee_amount ?? 0,
      };
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!paymentIntentId) return { kind: "ignored" };
      // Full charge amount, not amount_refunded — the recording RPC
      // validates against the order's total; partial-refund amount
      // tracking is a future enhancement (MVP scope: one payments row
      // per order, see the migration comment).
      return {
        kind: "record_refund",
        providerPaymentIntentId: paymentIntentId,
        amountMinorUnits: charge.amount,
        currency: charge.currency.toUpperCase(),
      };
    }
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const status = toAccountCapabilityStatus(account);
      return {
        kind: "sync_account",
        stripeAccountId: account.id,
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        detailsSubmitted: status.detailsSubmitted,
      };
    }
    default:
      return { kind: "ignored" };
  }
}
