import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730030000_add_catalogue_query_indexes.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("catalogue query index and public-read contract", () => {
  it("creates indexed paths for retailer status, price, weight, and accepted assignments", () => {
    expect(migration).toContain("product_variants_price_minor_idx");
    expect(migration).toContain("products_retailer_status_created_idx");
    expect(migration).toContain("product_fabric_profiles_weight_idx");
    expect(migration).toContain("price_amount_minor_units");
    expect(migration).toContain("fabric_weight_grams_per_square_metre");
    expect(migration).toContain("retailer_id, status, created_at desc");
  });

  it("grants anon select only for active concepts and active-catalogue fabric profiles", () => {
    expect(migration).toContain(
      "grant select on table public.metadata_concepts to anon",
    );
    expect(migration).toContain(
      "grant select on table public.product_fabric_profiles to anon",
    );
    expect(migration).toContain(
      "anyone can read active storefront metadata concepts",
    );
    expect(migration).toContain(
      "anyone can read fabric profiles for active catalogue",
    );
    expect(migration).toContain("active = true");
    expect(migration).toContain("product.status = 'active'");
  });
});
