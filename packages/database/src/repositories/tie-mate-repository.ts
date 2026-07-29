import {
  asId,
  buildTieMateDeck,
  money,
  resolveTieConceptIds,
  type CurrencyCode,
  type MetadataConceptId,
  type ProductId,
  type RetailerId,
  type TieMateDeck,
  type TieMateDeckOptions,
  type TieMateFabricCandidate,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ProductVariantRow =
  Database["public"]["Tables"]["product_variants"]["Row"];
type AssignmentRow =
  Database["public"]["Tables"]["entity_metadata_assignments"]["Row"];
type ConceptRow = Database["public"]["Tables"]["metadata_concepts"]["Row"];

export type TieMateBuildDeckParams = {
  readonly retailerId: RetailerId;
  readonly slug: string;
  readonly requireInStock?: boolean;
  readonly maxCards?: number;
  readonly pinnedProductIds?: readonly ProductId[];
};

/**
 * Prefer an in-stock variant for live stock truth; fall back to the
 * earliest variant so out-of-stock ties still project and can be skipped.
 * Made-to-order products treat any variant as sellable.
 */
function pickVariant(
  variants: readonly ProductVariantRow[],
  isMadeToOrder: boolean,
): ProductVariantRow | undefined {
  if (variants.length === 0) {
    return undefined;
  }
  const ordered = [...variants].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  if (isMadeToOrder) {
    return ordered[0];
  }
  return ordered.find((row) => row.inventory_quantity > 0) ?? ordered[0];
}

/**
 * Projects live catalogue rows into Tie-Mate fabric candidates and builds
 * the pure domain deck. Does not invent UI, photos, or a parallel catalogue.
 */
export class TieMateRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /**
   * Project tenant products + stock + accepted concept IDs into
   * `TieMateFabricCandidate`. Pending/rejected assignments never enter.
   * Products without a sellable variant are omitted.
   */
  async projectFabricCandidates(
    retailerId: RetailerId,
  ): Promise<TieMateFabricCandidate[]> {
    const { data: products, error: productsError } = await this.client
      .from("products")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (productsError) {
      throw productsError;
    }
    if (products.length === 0) {
      return [];
    }

    const productIds = products.map((row) => row.id);
    const [variants, assignments] = await Promise.all([
      this.loadVariants(productIds),
      this.loadAcceptedAssignments(retailerId),
    ]);

    const variantsByProduct = new Map<string, ProductVariantRow[]>();
    const variantToProduct = new Map<string, string>();
    for (const variant of variants) {
      const bucket = variantsByProduct.get(variant.product_id) ?? [];
      bucket.push(variant);
      variantsByProduct.set(variant.product_id, bucket);
      variantToProduct.set(variant.id, variant.product_id);
    }

    const conceptsByProduct = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      if (assignment.review_status !== "accepted") {
        continue;
      }
      let productId: string | undefined;
      if (assignment.target_type === "product") {
        productId = assignment.target_id;
      } else if (assignment.target_type === "product_variant") {
        productId = variantToProduct.get(assignment.target_id);
      }
      if (productId === undefined || !productIds.includes(productId)) {
        continue;
      }
      const bucket = conceptsByProduct.get(productId) ?? new Set();
      bucket.add(assignment.concept_id);
      conceptsByProduct.set(productId, bucket);
    }

    const candidates: TieMateFabricCandidate[] = [];
    for (const row of products) {
      const productVariants = variantsByProduct.get(row.id) ?? [];
      const variant = pickVariant(productVariants, row.is_made_to_order);
      if (variant === undefined) {
        continue;
      }
      const conceptIds = [...(conceptsByProduct.get(row.id) ?? [])].map((id) =>
        asId<"MetadataConceptId">(id),
      );
      const candidate: TieMateFabricCandidate = {
        productId: asId<"ProductId">(row.id),
        productSlug: row.slug,
        name: row.name,
        status: row.status,
        variantId: asId<"ProductVariantId">(variant.id),
        price: money(
          variant.price_amount_minor_units,
          variant.price_currency as CurrencyCode,
        ),
        inventoryQuantity: variant.inventory_quantity,
        acceptedConceptIds: conceptIds,
        ...(row.primary_image_url
          ? { primaryImageUrl: row.primary_image_url }
          : {}),
        ...(row.swatch_image_url
          ? { swatchImageUrl: row.swatch_image_url }
          : {}),
        ...(row.is_made_to_order ? { isMadeToOrder: true } : {}),
      };
      candidates.push(candidate);
    }
    return candidates;
  }

  /**
   * Resolve accepted neckwear/tie `garment_type` concept IDs visible to the
   * retailer (canonical + tenant-local).
   */
  async resolveTieConceptIdsForRetailer(
    retailerId: RetailerId,
  ): Promise<ReadonlySet<MetadataConceptId>> {
    const concepts = await this.loadVisibleConcepts(retailerId);
    return resolveTieConceptIds({
      concepts: concepts.map((row) => ({
        id: asId<"MetadataConceptId">(row.id),
        kind: row.kind,
        slug: row.slug,
        label: row.canonical_name,
      })),
    });
  }

  /**
   * Project catalogue candidates and feed `buildTieMateDeck`.
   */
  async buildDeck(params: TieMateBuildDeckParams): Promise<TieMateDeck> {
    const [candidates, tieConceptIds] = await Promise.all([
      this.projectFabricCandidates(params.retailerId),
      this.resolveTieConceptIdsForRetailer(params.retailerId),
    ]);

    const options: TieMateDeckOptions = {
      retailerId: params.retailerId,
      slug: params.slug,
      tieConceptIds,
      ...(params.requireInStock === undefined
        ? {}
        : { requireInStock: params.requireInStock }),
      ...(params.maxCards === undefined ? {} : { maxCards: params.maxCards }),
      ...(params.pinnedProductIds === undefined
        ? {}
        : { pinnedProductIds: params.pinnedProductIds }),
    };

    return buildTieMateDeck(candidates, options);
  }

  private async loadVisibleConcepts(
    retailerId: RetailerId,
  ): Promise<ConceptRow[]> {
    const { data, error } = await this.client
      .from("metadata_concepts")
      .select("*")
      .or(`retailer_id.is.null,retailer_id.eq.${retailerId}`)
      .eq("active", true)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }
    return data;
  }

  private async loadVariants(
    productIds: readonly string[],
  ): Promise<ProductVariantRow[]> {
    const { data, error } = await this.client
      .from("product_variants")
      .select("*")
      .in("product_id", [...productIds])
      .is("deleted_at", null);

    if (error) {
      throw error;
    }
    return data;
  }

  private async loadAcceptedAssignments(
    retailerId: RetailerId,
  ): Promise<AssignmentRow[]> {
    const { data, error } = await this.client
      .from("entity_metadata_assignments")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("review_status", "accepted")
      .in("target_type", ["product", "product_variant"])
      .is("deleted_at", null);

    if (error) {
      throw error;
    }
    return data;
  }
}
