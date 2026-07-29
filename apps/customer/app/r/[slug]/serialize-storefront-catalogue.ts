import {
  CatalogueQueryRepository,
  MetadataRepository,
  type PaonSupabaseClient,
} from "@paon/database";
import {
  projectStorefrontCatalogueFacets,
  type MetadataConcept,
  type ProductId,
  type ProductVariantId,
  type RetailerId,
  type StorefrontCatalogueFacetFields,
} from "@paon/domain";

export interface StorefrontCatalogueProductRef {
  readonly id: ProductId;
  readonly slug: string;
  readonly variantIds: readonly ProductVariantId[];
}

export type StorefrontCatalogueByProduct = Record<
  string,
  StorefrontCatalogueFacetFields
>;

/**
 * Load accepted metadata + fabric weight and project founder-compatible
 * facet fields per product slug. Heuristics remain the fallback in route.ts.
 */
export async function loadStorefrontCatalogueByProduct(
  client: PaonSupabaseClient,
  retailerId: RetailerId,
  products: readonly StorefrontCatalogueProductRef[],
): Promise<StorefrontCatalogueByProduct> {
  if (products.length === 0) {
    return {};
  }

  const metadata = new MetadataRepository(client);
  const catalogue = new CatalogueQueryRepository(client);

  const [acceptedAssignments, visibleConcepts, candidates] = await Promise.all([
    metadata.findAssignmentsForReview(retailerId, "accepted"),
    metadata.findVisibleConcepts(retailerId),
    catalogue.projectCandidates(retailerId),
  ]);

  const conceptById = new Map(
    visibleConcepts.map((concept) => [concept.id as string, concept]),
  );
  const weightByProductId = new Map(
    candidates.map((candidate) => [
      candidate.productId as string,
      candidate.fabricWeightGramsPerSquareMetre,
    ]),
  );

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

  const payload: StorefrontCatalogueByProduct = {};
  for (const product of products) {
    const ids = [...(conceptIdsByProductId.get(product.id) ?? [])];
    const concepts: MetadataConcept[] = ids
      .map((id) => conceptById.get(id))
      .filter((concept): concept is MetadataConcept => concept !== undefined);
    payload[product.slug] = projectStorefrontCatalogueFacets(
      concepts,
      weightByProductId.get(product.id) ?? null,
    );
  }
  return payload;
}

export function serializeStorefrontCatalogueJson(
  catalogueByProduct: StorefrontCatalogueByProduct,
): string {
  return JSON.stringify(catalogueByProduct);
}

/** Prefer metadata-backed founder filter values when present. */
export function preferCatalogueFacetValue(
  metadataValue: string | undefined,
  heuristicValue: string,
): string {
  return metadataValue !== undefined && metadataValue.length > 0
    ? metadataValue
    : heuristicValue;
}
