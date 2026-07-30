/**
 * Tenant-scoped customer-interest projection (CLI-002 / PHASE 7.1).
 * Loads a bounded recent evidence window and accepted assignments/concepts
 * without N+1 queries, then runs the pure domain projector.
 */

import {
  asId,
  INTEREST_ATTRIBUTE_KINDS,
  INTEREST_SCOPE_KINDS,
  productIdFromEventProperties,
  productVariantIdFromEventProperties,
  projectCustomerInterestInsights,
  type CustomerId,
  type CustomerInterestProjection,
  type InterestProductMetadata,
  type MetadataConceptKind,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { AnalyticsRepository } from "./analytics-repository";
import { CustomerConsentRepository } from "./customer-consent-repository";

type AssignmentRow =
  Database["public"]["Tables"]["entity_metadata_assignments"]["Row"];
type ConceptRow = Database["public"]["Tables"]["metadata_concepts"]["Row"];

const INTEREST_EVENT_LIMIT = 200;

export interface CustomerInterestRepositoryDeps {
  readonly consent: CustomerConsentRepository;
  readonly analytics: AnalyticsRepository;
}

function isInterestKind(kind: string): kind is MetadataConceptKind {
  return (
    (INTEREST_SCOPE_KINDS as readonly string[]).includes(kind) ||
    (INTEREST_ATTRIBUTE_KINDS as readonly string[]).includes(kind)
  );
}

export class CustomerInterestRepository {
  private readonly deps: CustomerInterestRepositoryDeps;
  private readonly client: PaonSupabaseClient;

  constructor(
    client: PaonSupabaseClient,
    deps?: Partial<CustomerInterestRepositoryDeps>,
  ) {
    this.client = client;
    this.deps = {
      consent: deps?.consent ?? new CustomerConsentRepository(client),
      analytics: deps?.analytics ?? new AnalyticsRepository(client),
    };
  }

  /**
   * Project cited recent-interest insights for one retailer-customer
   * relationship. `viewerRetailerId` must match `retailerId`; domain rules
   * fail closed otherwise.
   */
  async projectForCustomer(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly viewerRetailerId: RetailerId;
    readonly now?: string;
    readonly windowDays?: number;
  }): Promise<CustomerInterestProjection> {
    const now = args.now ?? new Date().toISOString();

    const [consent, events] = await Promise.all([
      this.deps.consent.getState(args.retailerId, args.customerId),
      this.deps.analytics.findRecentByCustomer(
        args.retailerId,
        args.customerId,
        INTEREST_EVENT_LIMIT,
      ),
    ]);

    const productIds = new Set<string>();
    const variantIds = new Set<string>();
    for (const event of events) {
      const productId = productIdFromEventProperties(event.properties);
      const variantId = productVariantIdFromEventProperties(event.properties);
      if (productId) productIds.add(productId);
      if (variantId) variantIds.add(variantId);
    }

    const productMetadata = await this.loadAcceptedProductMetadata({
      retailerId: args.retailerId,
      productIds,
      variantIds,
    });

    return projectCustomerInterestInsights({
      retailerId: args.retailerId,
      customerId: args.customerId,
      viewerRetailerId: args.viewerRetailerId,
      now,
      consent,
      events,
      productMetadata,
      ...(args.windowDays !== undefined ? { windowDays: args.windowDays } : {}),
    });
  }

  private async loadAcceptedProductMetadata(args: {
    readonly retailerId: RetailerId;
    readonly productIds: ReadonlySet<string>;
    readonly variantIds: ReadonlySet<string>;
  }): Promise<Map<string, InterestProductMetadata>> {
    if (args.productIds.size === 0 && args.variantIds.size === 0) {
      return new Map();
    }

    const relevantProductIds = new Set(args.productIds);

    if (args.variantIds.size > 0) {
      const { data: eventVariants, error: eventVariantError } =
        await this.client
          .from("product_variants")
          .select("id, product_id")
          .in("id", [...args.variantIds])
          .is("deleted_at", null);
      if (eventVariantError) throw eventVariantError;
      for (const row of eventVariants) {
        relevantProductIds.add(row.product_id);
      }
    }

    if (relevantProductIds.size === 0) {
      return new Map();
    }

    const [{ data: parentVariants, error: parentVariantError }, assignments] =
      await Promise.all([
        this.client
          .from("product_variants")
          .select("id, product_id")
          .in("product_id", [...relevantProductIds])
          .is("deleted_at", null),
        this.loadAcceptedAssignments(args.retailerId),
      ]);
    if (parentVariantError) throw parentVariantError;

    const variantToProduct = new Map(
      parentVariants.map((row) => [row.id, row.product_id]),
    );

    const conceptsByProduct = new Map<string, Set<string>>();
    const conceptIds = new Set<string>();

    for (const assignment of assignments) {
      if (assignment.review_status !== "accepted") continue;
      let productId: string | null = null;
      if (assignment.target_type === "product") {
        productId = assignment.target_id;
      } else if (assignment.target_type === "product_variant") {
        productId = variantToProduct.get(assignment.target_id) ?? null;
      }
      if (!productId || !relevantProductIds.has(productId)) continue;

      conceptIds.add(assignment.concept_id);
      const set = conceptsByProduct.get(productId) ?? new Set<string>();
      set.add(assignment.concept_id);
      conceptsByProduct.set(productId, set);
    }

    const concepts = await this.loadConceptsByIds(args.retailerId, conceptIds);
    const result = new Map<string, InterestProductMetadata>();

    for (const [productId, conceptIdSet] of conceptsByProduct) {
      const accepted = [...conceptIdSet]
        .map((conceptId) => concepts.get(conceptId))
        .filter((concept): concept is ConceptRow => Boolean(concept))
        .filter((concept) => isInterestKind(concept.kind))
        .map((concept) => ({
          conceptId: asId<"MetadataConceptId">(concept.id),
          kind: concept.kind as MetadataConceptKind,
          label: concept.canonical_name,
        }));

      if (accepted.length === 0) continue;
      result.set(productId, {
        productId: asId<"ProductId">(productId),
        concepts: accepted,
      });
    }

    return result;
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

    if (error) throw error;
    return data;
  }

  private async loadConceptsByIds(
    retailerId: RetailerId,
    conceptIds: ReadonlySet<string>,
  ): Promise<Map<string, ConceptRow>> {
    if (conceptIds.size === 0) return new Map();
    const { data, error } = await this.client
      .from("metadata_concepts")
      .select("*")
      .in("id", [...conceptIds])
      .or(`retailer_id.is.null,retailer_id.eq.${retailerId}`)
      .is("deleted_at", null)
      .eq("active", true);
    if (error) throw error;
    return new Map(data.map((row) => [row.id, row]));
  }
}
