import { describe, expect, it } from "vitest";

import {
  createCollectionInputSchema,
  createProductInputSchema,
  createProductVariantInputSchema,
} from "./product.schema";

describe("createCollectionInputSchema", () => {
  it("accepts a valid payload", () => {
    const result = createCollectionInputSchema.parse({
      name: "Autumn 2026",
      slug: "autumn-2026",
      season: "FW26",
    });
    expect(result.slug).toBe("autumn-2026");
  });

  it("rejects an invalid slug", () => {
    const result = createCollectionInputSchema.safeParse({
      name: "Autumn 2026",
      slug: "Not A Slug!",
    });
    expect(result.success).toBe(false);
  });
});

describe("createProductInputSchema", () => {
  it("defaults status to draft and flags to false", () => {
    const result = createProductInputSchema.parse({
      name: "Bespoke Wool Overcoat",
      slug: "bespoke-wool-overcoat",
    });
    expect(result.status).toBe("draft");
    expect(result.isMadeToOrder).toBe(false);
    expect(result.isAlterable).toBe(false);
    expect(result.description).toBe("");
  });

  it("rejects an invalid slug", () => {
    const result = createProductInputSchema.safeParse({
      name: "Overcoat",
      slug: "Not A Slug!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported status", () => {
    const result = createProductInputSchema.safeParse({
      name: "Overcoat",
      slug: "overcoat",
      status: "published",
    });
    expect(result.success).toBe(false);
  });
});

describe("createProductVariantInputSchema", () => {
  it("coerces numeric form fields and defaults inventoryQuantity", () => {
    const result = createProductVariantInputSchema.parse({
      sku: "COAT-BLK-42",
      priceAmountMinorUnits: "45000",
      priceCurrency: "USD",
    });
    expect(result.priceAmountMinorUnits).toBe(45000);
    expect(result.inventoryQuantity).toBe(0);
  });

  it("rejects a negative price", () => {
    const result = createProductVariantInputSchema.safeParse({
      sku: "COAT-BLK-42",
      priceAmountMinorUnits: "-1",
      priceCurrency: "USD",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing SKU", () => {
    const result = createProductVariantInputSchema.safeParse({
      sku: "",
      priceAmountMinorUnits: "100",
      priceCurrency: "USD",
    });
    expect(result.success).toBe(false);
  });
});
