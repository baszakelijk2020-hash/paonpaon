import { describe, expect, it } from "vitest";

import {
  assignSubscriptionPlanInputSchema,
  updateCommercialPlanInputSchema,
  updateSubscriptionPlanPriceInputSchema,
} from "./subscription.schema";

describe("assignSubscriptionPlanInputSchema", () => {
  it("accepts valid retailer and plan ids", () => {
    const result = assignSubscriptionPlanInputSchema.safeParse({
      retailerId: "11111111-1111-1111-1111-111111111111",
      planId: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid planId", () => {
    const result = assignSubscriptionPlanInputSchema.safeParse({
      retailerId: "11111111-1111-1111-1111-111111111111",
      planId: "boutique",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateCommercialPlanInputSchema", () => {
  const valid = {
    planId: "11111111-1111-1111-1111-111111111111",
    name: "PAON Fused",
    positioning: "A professional digital customer foundation.",
    description: "A considered commercial foundation for premium retail.",
    priceAmountMinorUnits: 34900,
    priceCurrency: "EUR",
    priceIsFrom: false,
    implementationFeeAmountMinorUnits: 150000,
    implementationFeeCurrency: "EUR",
    seatLimit: 5,
    includedFeatureKeys: ["crm", "appointments"],
    isPublic: true,
  };

  it("keeps recurring and implementation prices separate", () => {
    const result = updateCommercialPlanInputSchema.parse(valid);
    expect(result.priceAmountMinorUnits).toBe(34900);
    expect(result.implementationFeeAmountMinorUnits).toBe(150000);
  });

  it("rejects unknown or empty entitlement sets", () => {
    expect(
      updateCommercialPlanInputSchema.safeParse({
        ...valid,
        includedFeatureKeys: [],
      }).success,
    ).toBe(false);
    expect(
      updateCommercialPlanInputSchema.safeParse({
        ...valid,
        includedFeatureKeys: ["arbitrary_feature"],
      }).success,
    ).toBe(false);
  });
});

describe("updateSubscriptionPlanPriceInputSchema", () => {
  it("accepts a Stripe price id", () => {
    const result = updateSubscriptionPlanPriceInputSchema.parse({
      planId: "11111111-1111-1111-1111-111111111111",
      providerPriceId: "price_123",
    });
    expect(result.providerPriceId).toBe("price_123");
  });

  it("rejects an empty price id", () => {
    const result = updateSubscriptionPlanPriceInputSchema.safeParse({
      planId: "11111111-1111-1111-1111-111111111111",
      providerPriceId: "",
    });
    expect(result.success).toBe(false);
  });
});
