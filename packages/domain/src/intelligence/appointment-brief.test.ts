import { describe, expect, it } from "vitest";

import {
  computePriceComfortSummary,
  computeWishlistOwnershipGaps,
} from "./appointment-brief";

describe("computePriceComfortSummary", () => {
  it("returns null for a customer with no orders", () => {
    expect(computePriceComfortSummary([])).toBeNull();
  });

  it("bands a low average as value", () => {
    const result = computePriceComfortSummary([
      { amountMinorUnits: 10_000, currency: "USD" },
      { amountMinorUnits: 20_000, currency: "USD" },
    ]);
    expect(result).toEqual({
      band: "value",
      averageOrderValue: { amountMinorUnits: 15_000, currency: "USD" },
      orderCount: 2,
    });
  });

  it("bands exactly at the mid threshold as mid", () => {
    const result = computePriceComfortSummary([
      { amountMinorUnits: 50_000, currency: "USD" },
    ]);
    expect(result?.band).toBe("mid");
  });

  it("bands exactly at the premium threshold as premium", () => {
    const result = computePriceComfortSummary([
      { amountMinorUnits: 150_000, currency: "USD" },
    ]);
    expect(result?.band).toBe("premium");
  });

  it("bands exactly at the luxury threshold as luxury", () => {
    const result = computePriceComfortSummary([
      { amountMinorUnits: 400_000, currency: "USD" },
    ]);
    expect(result?.band).toBe("luxury");
  });

  it("averages across multiple orders, not just the latest", () => {
    const result = computePriceComfortSummary([
      { amountMinorUnits: 400_000, currency: "GBP" },
      { amountMinorUnits: 0, currency: "GBP" },
    ]);
    expect(result?.averageOrderValue).toEqual({
      amountMinorUnits: 200_000,
      currency: "GBP",
    });
    expect(result?.band).toBe("premium");
  });
});

describe("computeWishlistOwnershipGaps", () => {
  it("returns every wishlisted variant when nothing has been bought", () => {
    const result = computeWishlistOwnershipGaps({
      wishlistProductVariantIds: ["v1", "v2"],
      purchasedProductVariantIds: new Set(),
    });
    expect(result).toEqual([
      { productVariantId: "v1" },
      { productVariantId: "v2" },
    ]);
  });

  it("excludes a wishlisted variant the customer already bought", () => {
    const result = computeWishlistOwnershipGaps({
      wishlistProductVariantIds: ["v1", "v2"],
      purchasedProductVariantIds: new Set(["v1"]),
    });
    expect(result).toEqual([{ productVariantId: "v2" }]);
  });

  it("never duplicates a gap for a variant wishlisted more than once", () => {
    const result = computeWishlistOwnershipGaps({
      wishlistProductVariantIds: ["v1", "v1"],
      purchasedProductVariantIds: new Set(),
    });
    expect(result).toEqual([{ productVariantId: "v1" }]);
  });

  it("returns an empty list when everything wishlisted has been bought", () => {
    const result = computeWishlistOwnershipGaps({
      wishlistProductVariantIds: ["v1"],
      purchasedProductVariantIds: new Set(["v1"]),
    });
    expect(result).toEqual([]);
  });
});
