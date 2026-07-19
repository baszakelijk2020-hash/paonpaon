import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import {
  ProductVariantRepository,
  VariantSkuAlreadyExistsError,
} from "./product-variant-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type ProductVariantRow =
  Database["public"]["Tables"]["product_variants"]["Row"];

const row: ProductVariantRow = {
  id: "88888888-8888-8888-8888-888888888888",
  product_id: "77777777-7777-7777-7777-777777777777",
  sku: "COAT-BLK-42",
  size: "42",
  color: "Black",
  price_amount_minor_units: 450000,
  price_currency: "USD",
  compare_at_price_amount_minor_units: null,
  compare_at_price_currency: null,
  inventory_quantity: 3,
  lead_time_days: 21,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("ProductVariantRepository", () => {
  it("maps a row to a domain ProductVariant, building Money from split columns", async () => {
    const repo = new ProductVariantRepository(
      clientReturning({ data: row, error: null }),
    );
    const variant = await repo.findById(row.id as never);

    expect(variant?.sku).toBe("COAT-BLK-42");
    expect(variant?.price).toEqual({
      amountMinorUnits: 450000,
      currency: "USD",
    });
    expect(variant?.compareAtPrice).toBeUndefined();
    expect(variant?.leadTimeDays).toBe(21);
  });

  it("maps a list of rows in findByProduct()", async () => {
    const repo = new ProductVariantRepository(
      clientReturning({ data: [row], error: null }),
    );
    const variants = await repo.findByProduct(row.product_id as never);
    expect(variants).toHaveLength(1);
  });

  it("throws VariantSkuAlreadyExistsError on a unique constraint violation", async () => {
    const repo = new ProductVariantRepository(
      clientReturning({
        data: null,
        error: { code: "23505", message: "duplicate" },
      }),
    );

    await expect(
      repo.create({
        productId: row.product_id as never,
        sku: row.sku,
        price: { amountMinorUnits: 450000, currency: "USD" },
        inventoryQuantity: 3,
      }),
    ).rejects.toBeInstanceOf(VariantSkuAlreadyExistsError);
  });
});
