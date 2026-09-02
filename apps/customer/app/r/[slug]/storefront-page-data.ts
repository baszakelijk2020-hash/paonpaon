export interface StorefrontPageData {
  readonly slug: string;
  readonly retailerId: string;
  readonly tableServiceSignedIn: boolean;
  readonly weddingParties: readonly unknown[];
  readonly garments: readonly unknown[];
  readonly retailerName: string;
  readonly ogTitle: string;
  readonly ogDescription: string;
  readonly ogImage: string;
  readonly brandHead: string;
  readonly brandMark: string;
  readonly heroHtml: string;
  readonly entries: readonly unknown[];
  readonly defaultCategory: string;
  readonly categoryNames: readonly string[];
  readonly landOnGrid: boolean;
  readonly stores: readonly unknown[];
  readonly knowledgeByProduct: unknown;
  readonly catalogueByProduct: unknown;
  readonly footerHtml: string;
}

/**
 * Expands the server-built storefront data into the founder template.
 *
 * Keeping this boundary pure means the same data contract can be consumed by
 * a future React storefront page without changing the current raw HTML route.
 * The replacement order intentionally matches the existing route exactly.
 */
export function serializeStorefrontPage(
  template: string,
  data: StorefrontPageData,
): string {
  const html = template
    .replaceAll("__PAON_SLUG__", data.slug)
    .replaceAll("__PAON_RETAILER_ID__", data.retailerId)
    .replaceAll(
      "__PAON_TABLESERVICE_SIGNED_IN__",
      data.tableServiceSignedIn ? "true" : "false",
    )
    .replaceAll(
      "__PAON_WEDDING_PARTIES_JSON__",
      JSON.stringify(data.weddingParties),
    )
    .replaceAll("__PAON_GARMENTS_JSON__", JSON.stringify(data.garments))
    .replaceAll("__PAON_RETAILER_NAME__", data.retailerName)
    .replaceAll("__PAON_OG_TITLE__", data.ogTitle)
    .replaceAll("__PAON_OG_DESCRIPTION__", data.ogDescription)
    .replaceAll("__PAON_OG_IMAGE__", data.ogImage)
    .replaceAll("__PAON_BRAND_HEAD__", data.brandHead)
    .replaceAll("__PAON_BRAND_MARK__", data.brandMark)
    .replaceAll("__PAON_HERO_HTML__", data.heroHtml)
    .replaceAll("__PAON_PRODUCTS_JSON__", JSON.stringify(data.entries))
    .replaceAll(
      "__PAON_DEFAULT_CATEGORY_JSON__",
      JSON.stringify(data.defaultCategory),
    )
    .replaceAll(
      "__PAON_CATEGORY_NAMES_JSON__",
      JSON.stringify(data.categoryNames),
    )
    .replaceAll("__PAON_LAND_ON_GRID__", data.landOnGrid ? "true" : "false")
    .replaceAll("__PAON_STORES_JSON__", JSON.stringify(data.stores))
    .replaceAll(
      "__PAON_KNOWLEDGE_BY_PRODUCT_JSON__",
      JSON.stringify(data.knowledgeByProduct),
    )
    .replaceAll(
      "__PAON_CATALOGUE_BY_PRODUCT_JSON__",
      JSON.stringify(data.catalogueByProduct),
    )
    .replaceAll("__PAON_FOOTER_HTML__", data.footerHtml);

  if (html.includes("__PAON_")) {
    const leftovers = [...html.matchAll(/__PAON_[A-Z0-9_]+__/g)].map(
      (match) => match[0],
    );
    throw new Error(
      `Storefront template still contains unsubstituted placeholders: ${[...new Set(leftovers)].join(", ")}`,
    );
  }

  return html;
}
