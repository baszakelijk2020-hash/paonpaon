import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const storefrontReads = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260719000013_add_public_storefront_read_policies.sql",
    import.meta.url,
  ),
  "utf8",
);

const metadataStorefrontReads = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730020000_add_public_storefront_knowledge_reads.sql",
    import.meta.url,
  ),
  "utf8",
);

const catalogueQueryIndexes = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730030000_add_catalogue_query_indexes.sql",
    import.meta.url,
  ),
  "utf8",
);

/**
 * Tie-Mate reuses existing catalogue/metadata public-read contracts.
 * No new tables; security is the storefront-visible subset only.
 */
describe("Tie-Mate catalogue read security contract", () => {
  it("keeps anonymous product/variant reads limited to active catalogue", () => {
    expect(storefrontReads).toContain(
      "anyone can read active products from active retailers",
    );
    expect(storefrontReads).toContain(
      "anyone can read variants of publicly visible products",
    );
    expect(storefrontReads).toContain("status = 'active'");
  });

  it("exposes only accepted assignments for active catalogue to anon", () => {
    expect(metadataStorefrontReads).toContain(
      "anyone can read accepted assignments for active catalogue",
    );
    expect(metadataStorefrontReads).toContain("review_status = 'accepted'");
    expect(metadataStorefrontReads).toContain(
      "grant select on table public.entity_metadata_assignments to anon",
    );
  });

  it("keeps active metadata concepts readable for storefront discovery", () => {
    expect(catalogueQueryIndexes).toContain(
      "anyone can read active storefront metadata concepts",
    );
    expect(catalogueQueryIndexes).toContain(
      "grant select on table public.metadata_concepts to anon",
    );
    expect(catalogueQueryIndexes).toContain("active = true");
  });
});
