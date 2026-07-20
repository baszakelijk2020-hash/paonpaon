import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { RetailerSubscriptionRepository } from "./retailer-subscription-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type RetailerSubscriptionRow =
  Database["public"]["Tables"]["retailer_subscriptions"]["Row"];

const subscriptionRow: RetailerSubscriptionRow = {
  id: "22222222-2222-2222-2222-222222222222",
  retailer_id: "33333333-3333-3333-3333-333333333333",
  plan_id: "11111111-1111-1111-1111-111111111111",
  status: "active",
  current_period_start: "2026-01-01T00:00:00.000Z",
  current_period_end: "2026-02-01T00:00:00.000Z",
  trial_ends_at: null,
  cancel_at_period_end: false,
  provider_customer_id: "cus_123",
  provider_subscription_id: "sub_123",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("RetailerSubscriptionRepository", () => {
  it("maps a row to a domain RetailerSubscription", async () => {
    const repo = new RetailerSubscriptionRepository(
      clientReturning({ data: subscriptionRow, error: null }),
    );
    const subscription = await repo.findByRetailer(
      subscriptionRow.retailer_id as never,
    );
    expect(subscription?.status).toBe("active");
    expect(subscription?.providerSubscriptionId).toBe("sub_123");
    expect(subscription?.cancelAtPeriodEnd).toBe(false);
  });

  it("returns null when the retailer has no subscription yet", async () => {
    const repo = new RetailerSubscriptionRepository(
      clientReturning({ data: null, error: null }),
    );
    expect(await repo.findByRetailer("nonexistent" as never)).toBeNull();
  });

  it("create inserts the initial row and returns the mapped domain object", async () => {
    const repo = new RetailerSubscriptionRepository(
      clientReturning({ data: subscriptionRow, error: null }),
    );
    const subscription = await repo.create({
      retailerId: subscriptionRow.retailer_id as never,
      planId: subscriptionRow.plan_id as never,
      providerCustomerId: "cus_123",
      providerSubscriptionId: "sub_123",
      status: "active",
      currentPeriodStart: "2026-01-01T00:00:00.000Z",
      currentPeriodEnd: "2026-02-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    });
    expect(subscription.providerCustomerId).toBe("cus_123");
  });

  it("syncFromWebhook throws on a repository error", async () => {
    const repo = new RetailerSubscriptionRepository(
      clientReturning({ data: null, error: new Error("boom") }),
    );
    await expect(
      repo.syncFromWebhook("sub_123", {
        status: "canceled",
        cancelAtPeriodEnd: false,
      }),
    ).rejects.toThrow("boom");
  });
});
