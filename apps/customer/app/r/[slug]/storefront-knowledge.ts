import {
  KnowledgeRepository,
  MetadataRepository,
  type PaonSupabaseClient,
} from "@paon/database";
import {
  partitionDiscoveryForStorefront,
  rankKnowledgeDiscovery,
  type ProductId,
  type RetailerId,
  type StorefrontKnowledgeBySection,
} from "@paon/domain";

export type StorefrontKnowledgeByProductSlug = Readonly<
  Record<string, StorefrontKnowledgeBySection>
>;

export async function buildStorefrontKnowledgeByProductSlug(params: {
  readonly client: PaonSupabaseClient;
  readonly retailerId: RetailerId;
  readonly products: readonly {
    readonly id: ProductId;
    readonly slug: string;
  }[];
}): Promise<StorefrontKnowledgeByProductSlug> {
  if (params.products.length === 0) {
    return {};
  }

  const metadataRepo = new MetadataRepository(params.client);
  const knowledgeRepo = new KnowledgeRepository(params.client);
  const knowledgeByProductSlug: Record<string, StorefrontKnowledgeBySection> =
    {};

  await Promise.all(
    params.products.map(async (product) => {
      const assignments = await metadataRepo.findAssignmentsForTarget(
        params.retailerId,
        { targetType: "product", targetId: product.id },
      );
      const acceptedConceptIds = assignments
        .filter((assignment) => assignment.reviewStatus === "accepted")
        .map((assignment) => assignment.conceptId);

      if (acceptedConceptIds.length === 0) {
        return;
      }

      const candidates = await knowledgeRepo.projectDiscoveryCandidates(
        params.retailerId,
        acceptedConceptIds,
      );
      const ranked = rankKnowledgeDiscovery(
        {
          retailerId: params.retailerId,
          acceptedProductConceptIds: acceptedConceptIds,
          journey: "product_detail",
        },
        candidates,
      );

      if (ranked.length === 0) {
        return;
      }

      knowledgeByProductSlug[product.slug] =
        partitionDiscoveryForStorefront(ranked);
    }),
  );

  return knowledgeByProductSlug;
}

export function serializeStorefrontKnowledgeByProductSlug(
  knowledgeByProductSlug: StorefrontKnowledgeByProductSlug,
): string {
  return JSON.stringify(knowledgeByProductSlug);
}

export function emptyStorefrontKnowledgePayload(): StorefrontKnowledgeByProductSlug {
  return {};
}
