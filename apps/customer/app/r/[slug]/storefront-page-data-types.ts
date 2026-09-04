import type {
  StorefrontKnowledgePanels,
  StorefrontCatalogueFacetFields,
} from "@paon/domain";

/**
 * Typed entries for product grid display.
 * Built from Product + ProductVariant + Knowledge + Catalogue data.
 */
export interface StorefrontPageEntry {
  readonly id: string; // product.slug
  readonly img: string;
  readonly detailImg: string;
  readonly name: string;
  readonly price: string;
  readonly priceMinor: number;
  readonly color: string;
  readonly pattern: string;
  readonly season: string;
  readonly category: string;
  readonly brand: string;
  readonly description: string;
  readonly material: string;
  readonly variantName: string;
  readonly variantId: string | null;
  readonly inventoryQuantity: number;
  readonly soldOut: boolean;
  readonly conceptIds: readonly string[];
  readonly mill: string | null;
  readonly weave: string | null;
  readonly weightGsm: number | null;
}

/**
 * Wedding party or wardrobe item reference (for table service signing).
 */
export interface StorefrontPageContextItem {
  readonly id: string;
  readonly label: string;
}

/**
 * Store/appointment location.
 */
export interface StorefrontPageStore {
  readonly city: string;
  readonly address: string;
  readonly img: string;
}

/**
 * Knowledge panels keyed by product slug.
 */
export type StorefrontPageKnowledgeByProduct = Record<
  string,
  StorefrontKnowledgePanels
>;

/**
 * Catalogue facet fields keyed by product slug.
 */
export type StorefrontPageCatalogueByProduct = Record<
  string,
  StorefrontCatalogueFacetFields
>;
