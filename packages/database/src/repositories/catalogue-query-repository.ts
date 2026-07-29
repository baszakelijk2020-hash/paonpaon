import {
  asId,
  isCatalogueFacetKind,
  paginateCatalogueHits,
  resolveCatalogueIntent,
  scoreCatalogueCandidate,
  sortCatalogueHits,
  type CatalogueFacets,
  type CatalogueFacetKind,
  type CatalogueFacetValue,
  type CatalogueQueryCandidate,
  type CatalogueSearchHit,
  type CatalogueSearchRequest,
  type CatalogueSearchResult,
  type MetadataConcept,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductVariantRow =
  Database["public"]["Tables"]["product_variants"]["Row"];
type AssignmentRow =
  Database["public"]["Tables"]["entity_metadata_assignments"]["Row"];
type ConceptRow = Database["public"]["Tables"]["metadata_concepts"]["Row"];
type FabricProfileRow =
  Database["public"]["Tables"]["product_fabric_profiles"]["Row"];

function toConcept(row: ConceptRow): MetadataConcept {
  return {
    id: asId<"MetadataConceptId">(row.id),
    retailerId:
      row.retailer_id === null ? null : asId<"RetailerId">(row.retailer_id),
    kind: row.kind,
    slug: row.slug,
    canonicalName: row.canonical_name,
    attributes:
      row.attributes !== null &&
      typeof row.attributes === "object" &&
      !Array.isArray(row.attributes)
        ? row.attributes
        : {},
    ...(row.image_url === null ? {} : { imageUrl: row.image_url }),
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Indexed catalogue query repository (SRCH-001 / SRCH-002).
 * Uses accepted assignments only; pending/rejected rows never enter candidates.
 */
export class CatalogueQueryRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async search(
    request: CatalogueSearchRequest,
  ): Promise<CatalogueSearchResult> {
    const visibleConcepts = await this.loadVisibleConcepts(request.retailerId);
    const intent = resolveCatalogueIntent(request.query, visibleConcepts);

    const candidates = await this.projectCandidates(request.retailerId);
    const candidatesById = new Map(
      candidates.map((candidate) => [candidate.productId, candidate]),
    );

    const explicitConceptIds = request.conceptIds ?? [];
    const intentConceptIds = intent.resolvedConceptIds;
    const hasStructuredFilters =
      explicitConceptIds.length > 0 || request.ranges !== undefined;

    // Known intent with no approved concepts must not fabricate catalogue hits.
    if (
      (request.query ?? "").trim().length > 0 &&
      intent.matches.length > 0 &&
      intentConceptIds.length === 0 &&
      !hasStructuredFilters
    ) {
      return {
        hits: [],
        total: 0,
        page: Math.max(1, request.page),
        pageSize: Math.min(100, Math.max(1, request.pageSize)),
        unresolvedQueryTokens: [
          ...intent.unresolvedTokens,
          ...intent.matches.map((match) => match.phrase),
        ],
      };
    }

    const ranges = {
      ...(intentConceptIds.length > 0 ? intent.ranges : {}),
      ...request.ranges,
    };

    const scored: CatalogueSearchHit[] = [];
    for (const candidate of candidates) {
      const filter: Pick<CatalogueSearchRequest, "conceptIds" | "ranges"> = {
        ...(explicitConceptIds.length > 0
          ? { conceptIds: explicitConceptIds }
          : {}),
        ...(Object.keys(ranges).length > 0 ? { ranges } : {}),
      };
      const hit = scoreCatalogueCandidate(candidate, filter, intentConceptIds);
      if (hit === null) {
        continue;
      }
      scored.push(hit);
    }

    // If the free-text query resolved to nothing and left unresolved tokens,
    // return an empty page with transparent unresolved tokens — never fabricate.
    if (
      (request.query ?? "").trim().length > 0 &&
      intent.resolvedConceptIds.length === 0 &&
      intent.unresolvedTokens.length > 0 &&
      explicitConceptIds.length === 0 &&
      request.ranges === undefined
    ) {
      return {
        hits: [],
        total: 0,
        page: Math.max(1, request.page),
        pageSize: Math.min(100, Math.max(1, request.pageSize)),
        unresolvedQueryTokens: intent.unresolvedTokens,
      };
    }

    const sort =
      request.sort === "newest" && intent.sortHint === "relevance"
        ? "relevance"
        : request.sort;
    const sorted = sortCatalogueHits(scored, candidatesById, sort);
    const page = paginateCatalogueHits(sorted, request.page, request.pageSize);
    return {
      ...page,
      unresolvedQueryTokens: intent.unresolvedTokens,
    };
  }

  async listFacets(retailerId: RetailerId): Promise<CatalogueFacets> {
    const candidates = await this.projectCandidates(retailerId);
    const concepts = await this.loadVisibleConcepts(retailerId);
    const conceptById = new Map(concepts.map((c) => [c.id, c]));

    const counts = new Map<string, number>();
    let minPrice: number | null = null;
    let maxPrice: number | null = null;
    let minWeight: number | null = null;
    let maxWeight: number | null = null;

    for (const candidate of candidates) {
      if (candidate.minPriceMinor !== null) {
        minPrice =
          minPrice === null
            ? candidate.minPriceMinor
            : Math.min(minPrice, candidate.minPriceMinor);
        maxPrice =
          maxPrice === null
            ? candidate.minPriceMinor
            : Math.max(maxPrice, candidate.minPriceMinor);
      }
      if (candidate.fabricWeightGramsPerSquareMetre !== null) {
        const weight = candidate.fabricWeightGramsPerSquareMetre;
        minWeight = minWeight === null ? weight : Math.min(minWeight, weight);
        maxWeight = maxWeight === null ? weight : Math.max(maxWeight, weight);
      }
      const seen = new Set<string>();
      for (const conceptId of candidate.acceptedConceptIds) {
        if (seen.has(conceptId)) continue;
        seen.add(conceptId);
        counts.set(conceptId, (counts.get(conceptId) ?? 0) + 1);
      }
    }

    const byKind: Partial<Record<CatalogueFacetKind, CatalogueFacetValue[]>> =
      {};
    for (const [conceptId, productCount] of counts) {
      const concept = conceptById.get(asId<"MetadataConceptId">(conceptId));
      if (concept === undefined || !isCatalogueFacetKind(concept.kind)) {
        continue;
      }
      const value: CatalogueFacetValue = {
        conceptId: concept.id,
        kind: concept.kind,
        slug: concept.slug,
        label: concept.canonicalName,
        productCount,
      };
      const bucket = byKind[concept.kind] ?? [];
      bucket.push(value);
      byKind[concept.kind] = bucket;
    }

    for (const kind of Object.keys(byKind) as CatalogueFacetKind[]) {
      byKind[kind] = [...(byKind[kind] ?? [])].sort((a, b) =>
        a.label.localeCompare(b.label),
      );
    }

    return {
      retailerId,
      byKind,
      priceMinor: { min: minPrice, max: maxPrice },
      weightGramsPerSquareMetre: { min: minWeight, max: maxWeight },
    };
  }

  /**
   * Project active catalogue rows with accepted concept IDs, price, and weight.
   * Rejected/pending assignments are excluded by the review_status filter.
   */
  async projectCandidates(
    retailerId: RetailerId,
  ): Promise<CatalogueQueryCandidate[]> {
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

    const [variants, assignments, profiles] = await Promise.all([
      this.loadVariants(productIds),
      this.loadAcceptedAssignments(retailerId),
      this.loadFabricProfiles(retailerId, productIds),
    ]);

    const priceByProduct = new Map<string, { min: number; max: number }>();
    for (const variant of variants) {
      const existing = priceByProduct.get(variant.product_id);
      const amount = variant.price_amount_minor_units;
      if (existing === undefined) {
        priceByProduct.set(variant.product_id, { min: amount, max: amount });
      } else {
        existing.min = Math.min(existing.min, amount);
        existing.max = Math.max(existing.max, amount);
      }
    }

    const conceptsByProduct = new Map<string, Set<string>>();
    const variantToProduct = new Map<string, string>();
    for (const variant of variants) {
      variantToProduct.set(variant.id, variant.product_id);
    }
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

    const weightByProduct = new Map<string, number>();
    for (const profile of profiles) {
      if (profile.fabric_weight_grams_per_square_metre === null) {
        continue;
      }
      const weight = Number(profile.fabric_weight_grams_per_square_metre);
      if (!Number.isFinite(weight)) {
        continue;
      }
      // Prefer product-level profile; variant-specific overrides when present.
      if (profile.product_variant_id === null) {
        weightByProduct.set(profile.product_id, weight);
      } else if (!weightByProduct.has(profile.product_id)) {
        weightByProduct.set(profile.product_id, weight);
      }
    }

    return products.map((row: ProductRow) => {
      const price = priceByProduct.get(row.id);
      const conceptIds = [...(conceptsByProduct.get(row.id) ?? [])].map((id) =>
        asId<"MetadataConceptId">(id),
      );
      const weight = weightByProduct.get(row.id);
      const candidate: CatalogueQueryCandidate = {
        productId: asId<"ProductId">(row.id),
        name: row.name,
        slug: row.slug,
        createdAt: row.created_at,
        status: row.status,
        acceptedConceptIds: conceptIds,
        minPriceMinor: price?.min ?? null,
        maxPriceMinor: price?.max ?? null,
        fabricWeightGramsPerSquareMetre: weight ?? null,
      };
      return candidate;
    });
  }

  private async loadVisibleConcepts(
    retailerId: RetailerId,
  ): Promise<MetadataConcept[]> {
    const { data, error } = await this.client
      .from("metadata_concepts")
      .select("*")
      .or(`retailer_id.is.null,retailer_id.eq.${retailerId}`)
      .eq("active", true)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }
    return data.map(toConcept);
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

  private async loadFabricProfiles(
    retailerId: RetailerId,
    productIds: readonly string[],
  ): Promise<FabricProfileRow[]> {
    const { data, error } = await this.client
      .from("product_fabric_profiles")
      .select("*")
      .eq("retailer_id", retailerId)
      .in("product_id", [...productIds])
      .is("deleted_at", null);

    if (error) {
      throw error;
    }
    return data;
  }
}
