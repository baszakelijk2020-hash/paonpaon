import { describe, expect, it, vi } from "vitest";

import {
  createAccountOnboardingLink,
  createDirectChargeCheckoutSession,
  createExpressAccount,
  createExpressDashboardLoginLink,
  toAccountCapabilityStatus,
} from "./connect";

function fakeStripe(overrides: Record<string, unknown>) {
  return overrides as never;
}

describe("createExpressAccount", () => {
  it("creates an Express account with card_payments and transfers requested", async () => {
    const create = vi.fn().mockResolvedValue({ id: "acct_123" });
    const stripe = fakeStripe({ accounts: { create } });

    const account = await createExpressAccount(stripe, {
      email: "owner@example.com",
      country: "US",
    });

    expect(create).toHaveBeenCalledWith({
      type: "express",
      country: "US",
      email: "owner@example.com",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    expect(account).toEqual({ id: "acct_123" });
  });

  it("omits email when not provided", async () => {
    const create = vi.fn().mockResolvedValue({ id: "acct_123" });
    const stripe = fakeStripe({ accounts: { create } });

    await createExpressAccount(stripe, { country: "US" });

    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ email: expect.anything() }),
    );
  });
});

describe("createAccountOnboardingLink", () => {
  it("returns the onboarding link URL", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ url: "https://connect.stripe.com/onboard" });
    const stripe = fakeStripe({ accountLinks: { create } });

    const url = await createAccountOnboardingLink(stripe, {
      accountId: "acct_123",
      refreshUrl: "https://retailer.paon.test/settings/payments",
      returnUrl: "https://retailer.paon.test/settings/payments",
    });

    expect(create).toHaveBeenCalledWith({
      account: "acct_123",
      refresh_url: "https://retailer.paon.test/settings/payments",
      return_url: "https://retailer.paon.test/settings/payments",
      type: "account_onboarding",
    });
    expect(url).toBe("https://connect.stripe.com/onboard");
  });
});

describe("createExpressDashboardLoginLink", () => {
  it("returns the login link URL", async () => {
    const createLoginLink = vi
      .fn()
      .mockResolvedValue({ url: "https://connect.stripe.com/express/login" });
    const stripe = fakeStripe({ accounts: { createLoginLink } });

    const url = await createExpressDashboardLoginLink(stripe, "acct_123");

    expect(createLoginLink).toHaveBeenCalledWith("acct_123");
    expect(url).toBe("https://connect.stripe.com/express/login");
  });
});

describe("toAccountCapabilityStatus", () => {
  it("maps Stripe's snake_case fields to camelCase", () => {
    const status = toAccountCapabilityStatus({
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
    } as never);

    expect(status).toEqual({
      chargesEnabled: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
    });
  });
});

describe("createDirectChargeCheckoutSession", () => {
  it("creates a direct-charge session on the connected account with no fee when zero", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ url: "https://checkout.stripe.com/pay/cs_123" });
    const stripe = fakeStripe({ checkout: { sessions: { create } } });

    await createDirectChargeCheckoutSession(stripe, {
      connectedAccountId: "acct_123",
      amountMinorUnits: 450000,
      currency: "USD",
      platformFeeAmountMinorUnits: 0,
      orderId: "order-1",
      productName: "Order #ORD-1",
      successUrl: "https://shop.paon.test/success",
      cancelUrl: "https://shop.paon.test/cancel",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: 450000,
              product_data: { name: "Order #ORD-1" },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: { metadata: { orderId: "order-1" } },
      }),
      { stripeAccount: "acct_123" },
    );
  });

  it("includes application_fee_amount when a platform fee is configured", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ url: "https://checkout.stripe.com/pay/cs_123" });
    const stripe = fakeStripe({ checkout: { sessions: { create } } });

    await createDirectChargeCheckoutSession(stripe, {
      connectedAccountId: "acct_123",
      amountMinorUnits: 450000,
      currency: "USD",
      platformFeeAmountMinorUnits: 11250,
      orderId: "order-1",
      productName: "Order #ORD-1",
      successUrl: "https://shop.paon.test/success",
      cancelUrl: "https://shop.paon.test/cancel",
    });

    const [sessionParams] = create.mock.calls[0] as [
      { payment_intent_data: unknown },
    ];
    expect(sessionParams.payment_intent_data).toEqual({
      application_fee_amount: 11250,
      metadata: { orderId: "order-1" },
    });
  });
});
