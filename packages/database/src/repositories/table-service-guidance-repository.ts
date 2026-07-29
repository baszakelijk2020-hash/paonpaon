/**
 * TableService occasion guidance projection (ADV-001 / ADV-002 /
 * PHASE 3.4). Retrieves approved knowledge + explainable catalogue
 * shortlist and builds a citation-validated guidance plan. Optional AI
 * answers are supplied by the caller after `@paon/ai` generation —
 * this package does not depend on the AI provider.
 */

import {
  asId,
  buildOccasionGuidancePlan,
  formatGuidanceWidgetLines,
  rankKnowledgeDiscovery,
  refuseGroundedAnswer,
  resolveCatalogueIntent,
  resolveOccasionQuery,
  type ConversationIntent,
  type GroundedAnswer,
  type GroundedShortlistItem,
  type KnowledgeDiscoveryResult,
  type KnowledgeObjectId,
  type MetadataConceptId,
  type OccasionGuidancePlan,
  type ProductId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

import { CatalogueQueryRepository } from "./catalogue-query-repository";
import { KnowledgeRepository } from "./knowledge-repository";
import { MetadataRepository } from "./metadata-repository";
import { ProductRepository } from "./product-repository";
import { ProductVariantRepository } from "./product-variant-repository";
import { RetailerRepository } from "./retailer-repository";

export interface TableServiceGuidanceRequest {
  readonly retailerId: RetailerId;
  readonly slug: string;
  readonly intent?: ConversationIntent;
  readonly caption?: string;
  readonly freeText?: string;
  readonly question?: string;
  /** Optional already-validated AI answer from the app/`@paon/ai` layer. */
  readonly aiAnswer?: GroundedAnswer;
}

export interface TableServiceGuidanceRetrieval {
  readonly retailerName: string;
  readonly occasionQuery: string;
  readonly occasionLabel: string;
  readonly shortlist: readonly GroundedShortlistItem[];
  readonly knowledgeResults: readonly KnowledgeDiscoveryResult[];
  readonly knowledgeById: ReadonlyMap<
    string,
    { readonly title: string; readonly summary: string }
  >;
}

export interface TableServiceGuidanceResult {
  readonly plan: OccasionGuidancePlan;
  readonly chatLines: readonly string[];
  readonly retrieval: TableServiceGuidanceRetrieval;
}

export interface TableServiceGuidanceRepositoryDeps {
  readonly retailers: RetailerRepository;
  readonly catalogue: CatalogueQueryRepository;
  readonly knowledge: KnowledgeRepository;
  readonly metadata: MetadataRepository;
  readonly products: ProductRepository;
  readonly variants: ProductVariantRepository;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export class TableServiceGuidanceRepository {
  private readonly deps: TableServiceGuidanceRepositoryDeps;

  constructor(
    client: PaonSupabaseClient,
    deps?: Partial<TableServiceGuidanceRepositoryDeps>,
  ) {
    this.deps = {
      retailers: deps?.retailers ?? new RetailerRepository(client),
      catalogue: deps?.catalogue ?? new CatalogueQueryRepository(client),
      knowledge: deps?.knowledge ?? new KnowledgeRepository(client),
      metadata: deps?.metadata ?? new MetadataRepository(client),
      products: deps?.products ?? new ProductRepository(client),
      variants: deps?.variants ?? new ProductVariantRepository(client),
    };
  }

  async retrieveBasis(
    request: Omit<TableServiceGuidanceRequest, "aiAnswer" | "question">,
  ): Promise<TableServiceGuidanceRetrieval | null> {
    const retailer = await this.deps.retailers.findById(request.retailerId);
    if (!retailer || retailer.status !== "active") {
      return null;
    }

    const occasion = resolveOccasionQuery({
      ...(request.intent ? { intent: request.intent } : {}),
      ...(request.caption ? { caption: request.caption } : {}),
      ...(request.freeText ? { freeText: request.freeText } : {}),
    });

    const visibleConcepts = await this.deps.metadata.findVisibleConcepts(
      request.retailerId,
    );
    const intentResolution = resolveCatalogueIntent(
      occasion.query,
      visibleConcepts,
    );

    const search = await this.deps.catalogue.search({
      retailerId: request.retailerId,
      query: occasion.query,
      sort: "relevance",
      page: 1,
      pageSize: 6,
    });

    const shortlist: GroundedShortlistItem[] = [];
    for (const hit of search.hits.slice(0, 6)) {
      const product = await this.deps.products.findById(hit.productId);
      if (!product || product.status !== "active") continue;
      const variants = await this.deps.variants.findByProduct(product.id);
      const variant = variants[0];
      shortlist.push({
        productId: product.id,
        ...(variant ? { productVariantId: variant.id } : {}),
        name: product.name,
        slug: product.slug,
        explanation:
          hit.explanation.factors[0]?.detail ??
          "Matched accepted catalogue metadata for this occasion",
        factors: hit.explanation.factors,
        matchedConceptIds: hit.explanation.matchedConceptIds.map(String),
      });
    }

    const fromHits: MetadataConceptId[] = shortlist.flatMap((item) =>
      item.matchedConceptIds
        .filter(isUuid)
        .map((id) => asId<"MetadataConceptId">(id)),
    );
    const conceptIdsForDiscovery = [
      ...new Set([...fromHits, ...intentResolution.resolvedConceptIds]),
    ];

    const candidates = await this.deps.knowledge.projectDiscoveryCandidates(
      request.retailerId,
      conceptIdsForDiscovery,
    );

    const knowledgeResults = rankKnowledgeDiscovery(
      {
        retailerId: request.retailerId,
        acceptedProductConceptIds: conceptIdsForDiscovery,
        journey: "advisor",
        preferredCommercialIntents: ["educate", "justify_premium"],
        relationshipProximity: 0.6,
        minResults: 1,
        maxResults: 4,
      },
      candidates,
    );

    const knowledgeById = new Map(
      knowledgeResults.map((result) => [
        result.knowledgeObjectId as string,
        {
          title: result.presentation.title,
          summary: result.presentation.summary,
        },
      ]),
    );

    return {
      retailerName: retailer.displayName,
      occasionQuery: occasion.query,
      occasionLabel: occasion.label,
      shortlist,
      knowledgeResults,
      knowledgeById,
    };
  }

  async projectGuidance(
    request: TableServiceGuidanceRequest,
  ): Promise<TableServiceGuidanceResult> {
    const retrieval = await this.retrieveBasis(request);

    if (!retrieval) {
      const refused = refuseGroundedAnswer("no_approved_basis");
      const plan = buildOccasionGuidancePlan({
        retailerId: request.retailerId,
        slug: request.slug,
        occasionQuery: "wedding",
        occasionLabel: "your occasion",
        knowledgeResults: [],
        knowledgeById: new Map(),
        shortlist: [],
        aiAnswer: refused,
      });
      return {
        plan,
        chatLines: formatGuidanceWidgetLines(plan),
        retrieval: {
          retailerName: "",
          occasionQuery: "wedding",
          occasionLabel: "your occasion",
          shortlist: [],
          knowledgeResults: [],
          knowledgeById: new Map(),
        },
      };
    }

    const plan = buildOccasionGuidancePlan({
      retailerId: request.retailerId,
      slug: request.slug,
      occasionQuery: retrieval.occasionQuery,
      occasionLabel: retrieval.occasionLabel,
      ...(request.intent ? { intent: request.intent } : {}),
      ...(request.question ? { question: request.question } : {}),
      knowledgeResults: retrieval.knowledgeResults,
      knowledgeById: retrieval.knowledgeById,
      shortlist: retrieval.shortlist,
      ...(request.aiAnswer ? { aiAnswer: request.aiAnswer } : {}),
    });

    return {
      plan,
      chatLines: formatGuidanceWidgetLines(plan),
      retrieval,
    };
  }
}

export type { KnowledgeObjectId, OccasionGuidancePlan, ProductId };
