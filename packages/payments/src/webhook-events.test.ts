import { describe, expect, it } from "vitest";

import { parseStripeConnectEvent } from "./webhook-events";

function fakeEvent(type: string, object: unknown): never {
  return { id: "evt_123", type, data: { object } } as never;
}

describe("parseStripeConnectEvent", () => {
  it("maps payment_intent.succeeded to a captured record_payment action", () => {
    const action = parseStripeConnectEvent(
      fakeEvent("payment_intent.succeeded", {
        id: "pi_123",
        amount: 450000,
        currency: "usd",
        application_fee_amount: 11250,
        metadata: { orderId: "order-1" },
      }),
    );
    expect(action).toEqual({
      kind: "record_payment",
      orderId: "order-1",
      providerPaymentIntentId: "pi_123",
      amountMinorUnits: 450000,
      currency: "USD",
      status: "captured",
      platformFeeAmountMinorUnits: 11250,
    });
  });

  it("maps payment_intent.payment_failed to a failed record_payment action", () => {
    const action = parseStripeConnectEvent(
      fakeEvent("payment_intent.payment_failed", {
        id: "pi_124",
        amount: 450000,
        currency: "usd",
        application_fee_amount: null,
        metadata: { orderId: "order-1" },
      }),
    );
    expect(action).toMatchObject({ kind: "record_payment", status: "failed" });
  });

  it("ignores a payment_intent with no orderId metadata", () => {
    const action = parseStripeConnectEvent(
      fakeEvent("payment_intent.succeeded", {
        id: "pi_125",
        amount: 450000,
        currency: "usd",
        metadata: {},
      }),
    );
    expect(action).toEqual({ kind: "ignored" });
  });

  it("maps charge.refunded to a record_refund action using the full charge amount", () => {
    const action = parseStripeConnectEvent(
      fakeEvent("charge.refunded", {
        amount: 450000,
        currency: "usd",
        payment_intent: "pi_123",
      }),
    );
    expect(action).toEqual({
      kind: "record_refund",
      providerPaymentIntentId: "pi_123",
      amountMinorUnits: 450000,
      currency: "USD",
    });
  });

  it("resolves an expanded payment_intent object on a refunded charge", () => {
    const action = parseStripeConnectEvent(
      fakeEvent("charge.refunded", {
        amount: 450000,
        currency: "usd",
        payment_intent: { id: "pi_123" },
      }),
    );
    expect(action).toMatchObject({ providerPaymentIntentId: "pi_123" });
  });

  it("maps account.updated to a sync_account action", () => {
    const action = parseStripeConnectEvent(
      fakeEvent("account.updated", {
        id: "acct_123",
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
      }),
    );
    expect(action).toEqual({
      kind: "sync_account",
      stripeAccountId: "acct_123",
      chargesEnabled: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
    });
  });

  it("ignores an unrecognized event type", () => {
    const action = parseStripeConnectEvent(
      fakeEvent("customer.created", { id: "cus_123" }),
    );
    expect(action).toEqual({ kind: "ignored" });
  });
});
