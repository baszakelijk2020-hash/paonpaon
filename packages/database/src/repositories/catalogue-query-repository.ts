import {
  asId,
  catalogueSearchRequestSchema,
  CATALOGUE_FACET_KINDS,
  CATALOGUE_FACET_TO_CONCEPT_KIND,
  mergeCatalogueConceptFilters,
  metadataConceptKindForFacet,
  resolveCatalogueSearchIntent,
  type CatalogueFacetGroup,
  type CatalogueFacetOption,
  type CatalogueIntentResolution,
  type CatalogueSearchHit,
  type CatalogueSearchRequest,
  type CatalogueSearchResult,
  type MetadataConceptId,
  type ProductId,
  type RetailerId,
  type StorefrontCatalogueIntentConcept,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type SearchRow =
  Database["public"]["Functions"]["search_catalogue_products"]["Returns"][number];

type FacetRow =
  Database["public"]["Functions"]["list_catalogue_facets"]["Returns"][number];

function toFacetGroups(rows: FacetRow[]): CatalogueFacetGroup[] {
  const byKind = new Map<string, CatalogueFacetOption[]>();

  for (const row of rows) {
    const facetKind = CATALOGUE_FACET_KINDS.find((kind) => {
      if (kind === "weight" || kind === "price") {
        return false;
      }
      return CATALOGUE_FACET_TO_CONCEPT_KIND[kind] === row.concept_kind;
    });
    if (facetKind === undefined) {
      continue;
    }

    const options = byKind.get(facetKind) ?? [];
    options.push({
      conceptId: asId<"MetadataConceptId">(row.concept_id),
      kind: row.concept_kind as CatalogueFacetOption["kind"],
      slug: row.concept_slug,
      label: row.concept_label,
      productCount: Number(row.product_count),
    });
    byKind.set(facetKind, options);
  }

  return CATALOGUE_FACET_KINDS.filter((kind) => kind !== "price")
    .map((kind) => ({
      kind,
      options: byKind.get(kind) ?? [],
    }))
    .filter((group) => group.options.length > 0);
}

/**
 * Repository-backed structured catalogue query for SRCH-001/SRCH-002.
 * Ranking, intent resolution, and facet grouping stay in `@paon/domain`;
 * SQL filtering uses indexed accepted assignments only.
 */
export class CatalogueQueryRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async search(
    request: CatalogueSearchRequest,
    intentConcepts: readonly StorefrontCatalogueIntentConcept[] = [],
  ): Promise<CatalogueSearchResult> {
    const parsed = catalogueSearchRequestSchema.parse(request);
    const intent = resolveCatalogueSearchIntent(parsed.query, intentConcepts);
    const conceptIds = mergeCatalogueConceptFilters(
      parsed.conceptIds?.map((id) => asId<"MetadataConceptId">(id)),
      intent?.status === "resolved" ? intent.matchedConceptIds : undefined,
    );

    const keywordQuery =
      intent?.status === "resolved" ? undefined : parsed.query;

    const { data, error } = await this.client.rpc("search_catalogue_products", {
      p_retailer_id: parsed.retailerId,
      p_query: keywordQuery ?? null,
      p_concept_ids: conceptIds.length > 0 ? [...conceptIds] : null,
      p_min_weight: parsed.ranges?.minWeight ?? null,
      p_max_weight: parsed.ranges?.maxWeight ?? null,
      p_min_price_minor: parsed.ranges?.minPriceMinor ?? null,
      p_max_price_minor: parsed.ranges?.maxPriceMinor ?? null,
      p_sort: parsed.sort,
      p_page: parsed.page,
      p_page_size: parsed.pageSize,
    });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as SearchRow[];
    const totalCount = rows.length > 0 ? Number(rows[0]?.total_count ?? 0) : 0;
    const hits: CatalogueSearchHit[] = rows.map((row) => ({
      productId: asId<ProductId>(row.product_id),
      relevanceScore: Number(row.relevance_score),
    }));

    const facets = await this.listFacets(parsed.retailerId as RetailerId);

    return {
      hits,
      totalCount,
      page: parsed.page,
      pageSize: parsed.pageSize,
      facets,
      intent,
    };
  }

  async listFacets(retailerId: RetailerId): Promise<CatalogueFacetGroup[]> {
    const { data, error } = await this.client.rpc("list_catalogue_facets", {
      p_retailer_id: retailerId,
    });
    if (error) {
      throw error;
    }
    return toFacetGroups((data ?? []) as FacetRow[]);
  }

  async listIntentConcepts(
    retailerId: RetailerId,
  ): Promise<StorefrontCatalogueIntentConcept[]> {
    const facets = await this.listFacets(retailerId);
    return facets.flatMap((group) =>
      group.options.map((option) => ({
        id: option.conceptId,
        kind: option.kind,
        slug: option.slug,
        canonicalName: option.label,
      })),
    );
  }
}

export function catalogueFacetKindsForMetadata(): readonly Exclude<
  keyof typeof CATALOGUE_FACET_TO_CONCEPT_KIND,
  never
>[] {
  return Object.keys(CATALOGUE_FACET_TO_CONCEPT_KIND) as Array<
    keyof typeof CATALOGUE_FACET_TO_CONCEPT_KIND
  >;
}

export { metadataConceptKindForFacet };
export type { CatalogueIntentResolution, CatalogueSearchResult };
