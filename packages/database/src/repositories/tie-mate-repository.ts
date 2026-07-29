/**
 * Tie-Mate catalogue projections (PHASE 5.4 / TIE-001, ADR-065).
 *
 * Projects live retailer catalogue rows into `@paon/domain` fabric candidates.
 * Customer UI remains gated on an approved founder mobile surface (ADR-052).
 */

import {
  asId,
  buildTieMateDeck,
  money,
  resolveTieConceptIds,
  type MetadataConceptId,
  type RetailerId,
  type TieMateDeck,
  type TieMateDeckOptions,
  type TieMateFabricCandidate,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductVariantRow =
  Database["public"]["Tables"]["product_variants"]["Row"];
type AssignmentRow =
  Database["public"]["Tables"]["entity_metadata_assignments"]["Row"];
type ConceptRow = Database["public"]["Tables"]["metadata_concepts"]["Row"];

function mergeCandidateFields(
  product: ProductRow,
  variant: ProductVariantRow,
  acceptedConceptIds: readonly MetadataConceptId[],
): TieMateFabricCandidate {
  const candidate: TieMateFabricCandidate = {
    productId: asId<"ProductId">(product.id),
    productSlug: product.slug,
    name: product.name,
    status: product.status,
    variantId: asId<"ProductVariantId">(variant.id),
    price: money(
      variant.price_amount_minor_units,
      variant.price_currency as TieMateFabricCandidate["price"]["currency"],
    ),
    inventoryQuantity: variant.inventory_quantity,
    acceptedConceptIds,
    ...(product.is_made_to_order ? { isMadeToOrder: true } : {}),
    ...(product.primary_image_url
      ? { primaryImageUrl: product.primary_image_url }
      : {}),
    ...(product.swatch_image_url
      ? { swatchImageUrl: product.swatch_image_url }
      : {}),
  };
  return candidate;
}

export class TieMateRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /**
   * Project active catalogue rows into Tie-Mate fabric candidates.
   * Accepted assignments only; one row per sellable variant.
   */
  async projectFabricCandidates(
    retailerId: RetailerId,
  ): Promise<TieMateFabricCandidate[]> {
    const { data: products, error: productsError } = await this.client
      .from("products")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (productsError) {
      throw productsError;
    }
    if (products.length === 0) {
      return [];
    }

    const productIds = products.map((row) => row.id);
    const productById = new Map(products.map((row) => [row.id, row]));

    const [variants, assignments] = await Promise.all([
      this.loadVariants(productIds),
      this.loadAcceptedAssignments(retailerId),
    ]);

    const variantToProduct = new Map<string, string>();
    for (const variant of variants) {
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
    for (const variant of variants) {
      const product = productById.get(variant.product_id);
      if (product === undefined) {
        continue;
      }
      const conceptIds = [...(conceptsByProduct.get(product.id) ?? [])].map(
        (id) => asId<"MetadataConceptId">(id),
      );
      candidates.push(mergeCandidateFields(product, variant, conceptIds));
    }

    return candidates;
  }

  /**
   * Resolve accepted neckwear concepts and build a stock-truthful deck.
   */
  async buildDeck(
    args: Pick<TieMateDeckOptions, "retailerId" | "slug"> &
      Partial<
        Pick<
          TieMateDeckOptions,
          "requireInStock" | "maxCards" | "pinnedProductIds"
        >
      >,
  ): Promise<TieMateDeck> {
    const concepts = await this.loadVisibleConcepts(args.retailerId);
    const tieConceptIds = resolveTieConceptIds({
      concepts: concepts.map((concept) => ({
        id: asId<"MetadataConceptId">(concept.id),
        kind: concept.kind,
        slug: concept.slug,
        label: concept.canonical_name,
        reviewState: "accepted",
      })),
    });

    const candidates = await this.projectFabricCandidates(args.retailerId);
    const options: TieMateDeckOptions = {
      retailerId: args.retailerId,
      slug: args.slug,
      tieConceptIds,
      ...(args.requireInStock !== undefined
        ? { requireInStock: args.requireInStock }
        : {}),
      ...(args.maxCards !== undefined ? { maxCards: args.maxCards } : {}),
      ...(args.pinnedProductIds !== undefined
        ? { pinnedProductIds: args.pinnedProductIds }
        : {}),
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
