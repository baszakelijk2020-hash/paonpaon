import {
  CatalogueQueryRepository,
  MetadataRepository,
  ProductFabricProfileRepository,
  type PaonSupabaseClient,
} from "@paon/database";
import {
  asId,
  buildStorefrontCatalogueProductMetadata,
  pickStorefrontFilterValue,
  type CatalogueFacetGroup,
  type CatalogueIntentResolution,
  type MetadataConcept,
  type ProductId,
  type ProductVariantId,
  type RetailerId,
  type StorefrontCatalogueProductMetadata,
} from "@paon/domain";

export interface StorefrontCatalogueProductRef {
  readonly id: ProductId;
  readonly slug: string;
  readonly variantIds: readonly ProductVariantId[];
}

export interface StorefrontCatalogueContext {
  readonly metadataByProductId: ReadonlyMap<
    string,
    StorefrontCatalogueProductMetadata
  >;
  readonly facets: readonly CatalogueFacetGroup[];
  readonly searchQuery: string | null;
  readonly intent: CatalogueIntentResolution | null;
  readonly filteredProductIds: ReadonlySet<string> | null;
}

/**
 * Loads accepted catalogue metadata, optional structured search results, and
 * facet projections for founder storefront filter/search hooks.
 */
export async function loadStorefrontCatalogueContext(
  client: PaonSupabaseClient,
  retailerId: RetailerId,
  products: readonly StorefrontCatalogueProductRef[],
  searchQuery: string | null,
): Promise<StorefrontCatalogueContext> {
  const metadataRepo = new MetadataRepository(client);
  const fabricRepo = new ProductFabricProfileRepository(client);
  const catalogueQuery = new CatalogueQueryRepository(client);

  const [acceptedAssignments, facets, intentConcepts] = await Promise.all([
    metadataRepo.findAssignmentsForReview(retailerId, "accepted"),
    catalogueQuery.listFacets(retailerId),
    catalogueQuery.listIntentConcepts(retailerId),
  ]);

  const conceptIdsByProductId = new Map<string, Set<string>>();
  for (const product of products) {
    conceptIdsByProductId.set(product.id, new Set());
  }

  const variantToProductId = new Map<string, string>();
  for (const product of products) {
    for (const variantId of product.variantIds) {
      variantToProductId.set(variantId, product.id);
    }
  }

  for (const assignment of acceptedAssignments) {
    if (assignment.target.targetType === "product") {
      conceptIdsByProductId
        .get(assignment.target.targetId)
        ?.add(assignment.conceptId);
      continue;
    }
    if (assignment.target.targetType === "product_variant") {
      const productId = variantToProductId.get(assignment.target.targetId);
      if (productId === undefined) continue;
      conceptIdsByProductId.get(productId)?.add(assignment.conceptId);
    }
  }

  const uniqueConceptIds = [
    ...new Set([...conceptIdsByProductId.values()].flatMap((ids) => [...ids])),
  ];
  const conceptsById = new Map<string, MetadataConcept>();
  await Promise.all(
    uniqueConceptIds.map(async (conceptId) => {
      const concept = await metadataRepo.findConceptById(
        retailerId,
        asId<"MetadataConceptId">(conceptId),
      );
      if (concept !== null) {
        conceptsById.set(conceptId, concept);
      }
    }),
  );

  const metadataByProductId = new Map<
    string,
    StorefrontCatalogueProductMetadata
  >();
  await Promise.all(
    products.map(async (product) => {
      const conceptIds = [...(conceptIdsByProductId.get(product.id) ?? [])].map(
        (id) => asId<"MetadataConceptId">(id),
      );
      const profile = await fabricRepo.findForProduct(retailerId, product.id);
      metadataByProductId.set(
        product.id,
        buildStorefrontCatalogueProductMetadata(
          conceptIds,
          conceptsById,
          profile?.fabricWeightGramsPerSquareMetre,
        ),
      );
    }),
  );

  let intent: StorefrontCatalogueContext["intent"] = null;
  let filteredProductIds: ReadonlySet<string> | null = null;

  if (searchQuery !== null && searchQuery.trim().length > 0) {
    const searchResult = await catalogueQuery.search(
      {
        retailerId,
        query: searchQuery,
        sort: "relevance",
        page: 1,
        pageSize: Math.max(products.length, 1),
      },
      intentConcepts,
    );
    intent = searchResult.intent;
    filteredProductIds = new Set(
      searchResult.hits.map((hit) => hit.productId as string),
    );
  }

  return {
    metadataByProductId,
    facets,
    searchQuery,
    intent,
    filteredProductIds,
  };
}

export function shouldIncludeStorefrontProduct(
  productId: ProductId,
  context: Pick<StorefrontCatalogueContext, "filteredProductIds">,
): boolean {
  if (context.filteredProductIds === null) {
    return true;
  }
  return context.filteredProductIds.has(productId);
}

export function serializeStorefrontCatalogueJson(
  context: Pick<
    StorefrontCatalogueContext,
    "facets" | "intent" | "searchQuery"
  >,
): string {
  return JSON.stringify({
    searchQuery: context.searchQuery,
    intent: context.intent,
    facets: context.facets,
  });
}

export { pickStorefrontFilterValue };
