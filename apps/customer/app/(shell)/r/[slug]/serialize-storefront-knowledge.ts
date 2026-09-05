import {
  KnowledgeRepository,
  MetadataRepository,
  type PaonSupabaseClient,
} from "@paon/database";
import {
  asId,
  buildStorefrontKnowledgeByProduct,
  EMPTY_STOREFRONT_KNOWLEDGE_PANELS,
  rankStorefrontKnowledgePanels,
  type KnowledgeDiscoveryCandidate,
  type MetadataConceptId,
  type ProductId,
  type ProductVariantId,
  type RetailerId,
  type StorefrontKnowledgePanels,
} from "@paon/domain";

export interface StorefrontKnowledgeProductRef {
  readonly id: ProductId;
  readonly slug: string;
  readonly variantIds: readonly ProductVariantId[];
}

/**
 * Loads accepted catalogue concepts, projects ADR-060 discovery candidates
 * once per retailer, then ranks per founder panel for PDP mounts.
 */
export async function loadStorefrontKnowledgeByProduct(
  client: PaonSupabaseClient,
  retailerId: RetailerId,
  products: readonly StorefrontKnowledgeProductRef[],
): Promise<Record<string, StorefrontKnowledgePanels>> {
  if (products.length === 0) {
    return {};
  }

  const metadata = new MetadataRepository(client);
  const knowledge = new KnowledgeRepository(client);

  const acceptedAssignments = await metadata.findAssignmentsForReview(
    retailerId,
    "accepted",
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
      const bucket = conceptIdsByProductId.get(assignment.target.targetId);
      bucket?.add(assignment.conceptId);
      continue;
    }
    if (assignment.target.targetType === "product_variant") {
      const productId = variantToProductId.get(assignment.target.targetId);
      if (productId === undefined) continue;
      conceptIdsByProductId.get(productId)?.add(assignment.conceptId);
    }
  }

  const uniqueConceptIds: MetadataConceptId[] = [
    ...new Set([...conceptIdsByProductId.values()].flatMap((ids) => [...ids])),
  ].map((id) => asId<"MetadataConceptId">(id));

  let candidates: KnowledgeDiscoveryCandidate[] = [];
  if (uniqueConceptIds.length > 0) {
    candidates = await knowledge.projectDiscoveryCandidates(
      retailerId,
      uniqueConceptIds,
    );
  }

  const panelsBySlug = new Map<string, StorefrontKnowledgePanels>();
  for (const product of products) {
    const rawIds = [...(conceptIdsByProductId.get(product.id) ?? [])];
    if (rawIds.length === 0 || candidates.length === 0) {
      panelsBySlug.set(product.slug, EMPTY_STOREFRONT_KNOWLEDGE_PANELS);
      continue;
    }
    const conceptIds = rawIds.map((id) => asId<"MetadataConceptId">(id));
    panelsBySlug.set(
      product.slug,
      rankStorefrontKnowledgePanels(
        {
          retailerId,
          acceptedProductConceptIds: conceptIds,
          journey: "product_detail",
        },
        candidates,
      ),
    );
  }

  const payload = buildStorefrontKnowledgeByProduct(panelsBySlug);
  for (const product of products) {
    if (payload[product.slug] === undefined) {
      payload[product.slug] = EMPTY_STOREFRONT_KNOWLEDGE_PANELS;
    }
  }
  return payload;
}

/** Stable JSON for `__PAON_KNOWLEDGE_BY_PRODUCT_JSON__` injection. */
export function serializeStorefrontKnowledgeJson(
  knowledgeByProduct: Record<string, StorefrontKnowledgePanels>,
): string {
  return JSON.stringify(knowledgeByProduct);
}
