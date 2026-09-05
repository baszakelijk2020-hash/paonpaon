import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730030000_add_catalogue_query_indexes.sql",
    import.meta.url,
  ),
  "utf8",
);

const templatePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../apps/customer/app/(shell)/r/[slug]/paon-template.html",
);

/*
 * The catalogue query and its facet/derive helpers were extracted out of the
 * storefront Route Handler into this shared module, so both the React page
 * and the byte-exact raw route build their data through one path. The
 * assertions below follow the code; pointing them at the handler kept them
 * green only while the handler still held the logic.
 */
const catalogueSourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../apps/customer/app/(shell)/r/[slug]/get-storefront-page-data.ts",
);

const pageDataPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../apps/customer/app/(shell)/r/[slug]/storefront-page-data.ts",
);

/**
 * ENG-004 / SRCH-001: only authorized catalogue-query markers may appear in
 * the founder template. Broader redesign markers fail this allowlist.
 */
const AUTHORIZED_CATALOGUE_MARKERS = [
  "__PAON_CATALOGUE_BY_PRODUCT_JSON__",
  "PAON_CATALOGUE_BY_PRODUCT",
  "conceptIds",
] as const;

describe("public storefront catalogue query contract", () => {
  it("indexes price/weight/status paths used by catalogue query", () => {
    expect(migration).toContain("product_variants_price_minor_idx");
    expect(migration).toContain("product_fabric_profiles_weight_idx");
    expect(migration).toContain("products_retailer_status_created_idx");
  });
});

describe("founder storefront catalogue DOM allowlist", () => {
  it("only introduces authorized catalogue-query markers", () => {
    const template = readFileSync(templatePath, "utf8");
    const catalogueSource = readFileSync(catalogueSourcePath, "utf8");
    const pageData = readFileSync(pageDataPath, "utf8");

    expect(template).toContain("__PAON_CATALOGUE_BY_PRODUCT_JSON__");
    expect(template).toContain("PAON_CATALOGUE_BY_PRODUCT");
    expect(template).toContain("conceptIds");
    expect(template).toContain("productMatchesCatalogFilters");

    expect(catalogueSource).toContain("loadStorefrontCatalogueByProduct");
    expect(pageData).toContain("__PAON_CATALOGUE_BY_PRODUCT_JSON__");
    expect(catalogueSource).toContain("preferCatalogueFacetValue");
    // Heuristics remain until parity coverage retires them.
    expect(catalogueSource).toContain("deriveColor");
    expect(catalogueSource).toContain("derivePattern");
    expect(catalogueSource).toContain("deriveSeason");

    const catalogueMentions = [
      ...template.matchAll(/__PAON_CATALOGUE_[A-Z0-9_]+__/g),
      ...template.matchAll(/PAON_CATALOGUE[\w_]*/g),
    ].map((match) => match[0]);

    for (const mention of catalogueMentions) {
      const allowed = AUTHORIZED_CATALOGUE_MARKERS.some(
        (marker) => mention === marker || mention.startsWith(marker),
      );
      expect(allowed, `unauthorized marker: ${mention}`).toBe(true);
    }
  });
});
