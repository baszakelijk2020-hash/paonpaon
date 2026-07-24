import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { SubscriptionPlanRepository } from "./subscription-plan-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type SubscriptionPlanRow =
  Database["public"]["Tables"]["subscription_plans"]["Row"];

const planRow: SubscriptionPlanRow = {
  id: "11111111-1111-1111-1111-111111111111",
  key: "fused_monthly",
  name: "PAON Fused",
  positioning: "A professional digital customer foundation.",
  description: "The essential PAON customer foundation.",
  price_amount_minor_units: 34900,
  price_currency: "EUR",
  price_is_from: false,
  implementation_fee_amount_minor_units: 150000,
  implementation_fee_currency: "EUR",
  is_public: true,
  display_order: 10,
  billing_interval: "monthly",
  included_feature_keys: ["catalogue", "order_tracking"],
  seat_limit: 5,
  provider_price_id: null,
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

describe("SubscriptionPlanRepository", () => {
  it("maps a row to a domain SubscriptionPlan", async () => {
    const repo = new SubscriptionPlanRepository(
      clientReturning({ data: [planRow], error: null }),
    );
    const plans = await repo.findAll();
    expect(plans[0]?.price).toEqual({
      amountMinorUnits: 34900,
      currency: "EUR",
    });
    expect(plans[0]?.seatLimit).toBe(5);
    expect(plans[0]?.providerPriceId).toBeUndefined();
  });

  it("findById returns null when no plan matches", async () => {
    const repo = new SubscriptionPlanRepository(
      clientReturning({ data: null, error: null }),
    );
    expect(await repo.findById("nonexistent" as never)).toBeNull();
  });

  it("includes providerPriceId once set", async () => {
    const repo = new SubscriptionPlanRepository(
      clientReturning({
        data: { ...planRow, provider_price_id: "price_123" },
        error: null,
      }),
    );
    const plan = await repo.findById(planRow.id as never);
    expect(plan?.providerPriceId).toBe("price_123");
  });

  it("updateProviderPriceId throws on a repository error", async () => {
    const repo = new SubscriptionPlanRepository(
      clientReturning({ data: null, error: new Error("boom") }),
    );
    await expect(
      repo.updateProviderPriceId(planRow.id as never, "price_123"),
    ).rejects.toThrow("boom");
  });
});
