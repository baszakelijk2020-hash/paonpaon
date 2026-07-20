import { describe, expect, it, vi } from "vitest";

import {
  createBillingPortalSession,
  createPlatformCustomer,
  createPlatformSubscription,
  toCreatedSubscription,
} from "./billing";

function fakeStripe(overrides: Record<string, unknown>) {
  return overrides as never;
}

describe("createPlatformCustomer", () => {
  it("creates a customer with retailerId metadata", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cus_123" });
    const stripe = fakeStripe({ customers: { create } });

    await createPlatformCustomer(stripe, {
      name: "Maison Test",
      email: "owner@example.com",
      retailerId: "retailer-1",
    });

    expect(create).toHaveBeenCalledWith({
      name: "Maison Test",
      email: "owner@example.com",
      metadata: { retailerId: "retailer-1" },
    });
  });

  it("omits email when not provided", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cus_123" });
    const stripe = fakeStripe({ customers: { create } });

    await createPlatformCustomer(stripe, {
      name: "Maison Test",
      retailerId: "retailer-1",
    });

    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ email: expect.anything() }),
    );
  });
});

describe("toCreatedSubscription", () => {
  it("reads period dates from the first subscription item", () => {
    const result = toCreatedSubscription({
      id: "sub_123",
      status: "active",
      cancel_at_period_end: false,
      trial_end: null,
      items: {
        data: [
          { current_period_start: 1735689600, current_period_end: 1738368000 },
        ],
      },
    } as never);

    expect(result).toEqual({
      providerSubscriptionId: "sub_123",
      status: "active",
      currentPeriodStart: new Date(1735689600 * 1000).toISOString(),
      currentPeriodEnd: new Date(1738368000 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
    });
  });

  it("includes trialEndsAt when trial_end is set", () => {
    const result = toCreatedSubscription({
      id: "sub_124",
      status: "trialing",
      cancel_at_period_end: false,
      trial_end: 1735689600,
      items: { data: [] },
    } as never);

    expect(result.trialEndsAt).toBe(new Date(1735689600 * 1000).toISOString());
  });

  it("omits period dates when there is no subscription item", () => {
    const result = toCreatedSubscription({
      id: "sub_125",
      status: "incomplete",
      cancel_at_period_end: false,
      trial_end: null,
      items: { data: [] },
    } as never);

    expect(result.currentPeriodStart).toBeUndefined();
    expect(result.currentPeriodEnd).toBeUndefined();
  });
});

describe("createPlatformSubscription", () => {
  it("creates a subscription with a single price item and retailerId metadata", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "sub_123",
      status: "active",
      cancel_at_period_end: false,
      trial_end: null,
      items: { data: [{ current_period_start: 1, current_period_end: 2 }] },
    });
    const stripe = fakeStripe({ subscriptions: { create } });

    const result = await createPlatformSubscription(stripe, {
      customerId: "cus_123",
      priceId: "price_123",
      retailerId: "retailer-1",
    });

    expect(create).toHaveBeenCalledWith({
      customer: "cus_123",
      items: [{ price: "price_123" }],
      metadata: { retailerId: "retailer-1" },
    });
    expect(result.providerSubscriptionId).toBe("sub_123");
  });
});

describe("createBillingPortalSession", () => {
  it("returns the billing portal session URL", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ url: "https://billing.stripe.com/session/123" });
    const stripe = fakeStripe({ billingPortal: { sessions: { create } } });

    const url = await createBillingPortalSession(stripe, {
      customerId: "cus_123",
      returnUrl: "https://retailer.paon.test/settings/billing",
    });

    expect(create).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://retailer.paon.test/settings/billing",
    });
    expect(url).toBe("https://billing.stripe.com/session/123");
  });
});
