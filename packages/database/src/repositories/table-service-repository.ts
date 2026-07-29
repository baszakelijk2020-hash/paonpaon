import {
  asId,
  mapDiscoveryToCitations,
  mapHitsToShortlist,
  rankKnowledgeDiscovery,
  resolveCatalogueIntent,
  type KnowledgeDiscoveryResult,
  type MetadataConceptId,
  type ProductId,
  type RetailerId,
  type TableServiceOccasionBundle,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

import { CatalogueQueryRepository } from "./catalogue-query-repository";
import { KnowledgeRepository } from "./knowledge-repository";
import { ProductRepository } from "./product-repository";

const DEFAULT_OCCASION_QUERY = "summer wedding";

/**
 * Composes approved knowledge retrieval and occasion shortlist projection
 * for grounded TableService (PHASE 3.4). Ranking stays in `@paon/domain`.
 */
export class TableServiceRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async projectOccasionBundle(
    retailerId: RetailerId,
    occasionPhrase = DEFAULT_OCCASION_QUERY,
  ): Promise<TableServiceOccasionBundle> {
    const catalogueRepo = new CatalogueQueryRepository(this.client);
    const knowledgeRepo = new KnowledgeRepository(this.client);
    const productRepo = new ProductRepository(this.client);

    const visibleConcepts = await this.loadVisibleConcepts(retailerId);
    const intent = resolveCatalogueIntent(occasionPhrase, visibleConcepts);
    const resolvedConceptIds = intent.resolvedConceptIds;

    const searchResult = await catalogueRepo.search({
      retailerId,
      query: occasionPhrase,
      sort: "relevance",
      page: 1,
      pageSize: 12,
    });

    const productIds = searchResult.hits.map((hit) => hit.productId);
    const products = await Promise.all(
      productIds.map((id) => productRepo.findById(id)),
    );
    const productNames = new Map<string, string>();
    for (const product of products) {
      if (product) {
        productNames.set(product.id, product.name);
      }
    }

    let knowledgeResults: KnowledgeDiscoveryResult[] = [];
    if (resolvedConceptIds.length > 0) {
      const candidates = await knowledgeRepo.projectDiscoveryCandidates(
        retailerId,
        resolvedConceptIds,
      );
      knowledgeResults = rankKnowledgeDiscovery(
        {
          retailerId,
          acceptedProductConceptIds: resolvedConceptIds,
          journey: "advisor",
          relationshipProximity: 0.8,
          minResults: 2,
          maxResults: 4,
        },
        candidates,
      );
    }

    const knowledge = mapDiscoveryToCitations(knowledgeResults);
    const shortlist = mapHitsToShortlist(searchResult.hits, productNames);

    const intentExplanation =
      intent.matches[0]?.explanation ??
      (resolvedConceptIds.length > 0
        ? "Structured filters from accepted metadata"
        : "No approved concepts matched this occasion yet");

    return {
      retailerId,
      occasionPhrase,
      intentExplanation,
      resolvedConceptIds,
      knowledge,
      shortlist,
      allowedKnowledgeIds: knowledge.map((item) => item.knowledgeObjectId),
      allowedProductIds: shortlist.map((item) => item.productId),
    };
  }

  async loadProductConceptIds(
    retailerId: RetailerId,
    productId: ProductId,
  ): Promise<readonly MetadataConceptId[]> {
    const { data, error } = await this.client
      .from("entity_metadata_assignments")
      .select("concept_id")
      .eq("retailer_id", retailerId)
      .eq("target_type", "product")
      .eq("target_id", productId)
      .eq("review_status", "accepted")
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    return data.map((row) => asId<"MetadataConceptId">(row.concept_id));
  }

  private async loadVisibleConcepts(retailerId: RetailerId) {
    const { data, error } = await this.client
      .from("metadata_concepts")
      .select("*")
      .or(`retailer_id.is.null,retailer_id.eq.${retailerId}`)
      .eq("active", true)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    return data.map((row) => ({
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
    }));
  }
}
