/**
 * Unified For You projection (CLI-007 / PHASE 7.6).
 * Composes consent, behaviour, StyleProfile, facts, wardrobe, wishlist,
 * orders, moments, and catalogue candidates into the pure domain ranker.
 */

import {
  asId,
  forYouRecentProductIdsFromEvents,
  GARMENT_CATEGORIES,
  rankForYouRecommendations,
  type CustomerId,
  type ForYouCandidate,
  type ForYouRankingResult,
  type ForYouStyleSignals,
  type ForYouWardrobeGap,
  type GarmentCategoryCode,
  type MetadataConceptId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { AnalyticsRepository } from "./analytics-repository";
import { CustomerConsentRepository } from "./customer-consent-repository";
import { CustomerFactRepository } from "./customer-fact-repository";
import { OrderRepository } from "./order-repository";
import { ProductRepository } from "./product-repository";
import { ProductVariantRepository } from "./product-variant-repository";
import { StyleProfileRepository } from "./style-profile-repository";
import { WardrobeRepository } from "./wardrobe-repository";
import { WardrobeRoadmapRepository } from "./wardrobe-roadmap-repository";
import { WishlistRepository } from "./wishlist-repository";

type AssignmentRow =
  Database["public"]["Tables"]["entity_metadata_assignments"]["Row"];
type ConceptRow = Database["public"]["Tables"]["metadata_concepts"]["Row"];

const FOR_YOU_EVENT_LIMIT = 200;
const FOR_YOU_CATALOGUE_LIMIT = 48;

const garmentCategorySet = new Set<string>(GARMENT_CATEGORIES);

export interface ForYouRepositoryDeps {
  readonly consent: CustomerConsentRepository;
  readonly analytics: AnalyticsRepository;
  readonly styleProfile: StyleProfileRepository;
  readonly facts: CustomerFactRepository;
  readonly wishlist: WishlistRepository;
  readonly orders: OrderRepository;
  readonly wardrobe: WardrobeRepository;
  readonly wardrobeRoadmaps: WardrobeRoadmapRepository;
  readonly products: ProductRepository;
  readonly variants: ProductVariantRepository;
}

function isGarmentCategory(value: string): value is GarmentCategoryCode {
  return garmentCategorySet.has(value);
}

export class ForYouRepository {
  private readonly deps: ForYouRepositoryDeps;
  private readonly client: PaonSupabaseClient;

  constructor(
    client: PaonSupabaseClient,
    deps?: Partial<ForYouRepositoryDeps>,
  ) {
    this.client = client;
    this.deps = {
      consent: deps?.consent ?? new CustomerConsentRepository(client),
      analytics: deps?.analytics ?? new AnalyticsRepository(client),
      styleProfile: deps?.styleProfile ?? new StyleProfileRepository(client),
      facts: deps?.facts ?? new CustomerFactRepository(client),
      wishlist: deps?.wishlist ?? new WishlistRepository(client),
      orders: deps?.orders ?? new OrderRepository(client),
      wardrobe: deps?.wardrobe ?? new WardrobeRepository(client),
      wardrobeRoadmaps:
        deps?.wardrobeRoadmaps ?? new WardrobeRoadmapRepository(client),
      products: deps?.products ?? new ProductRepository(client),
      variants: deps?.variants ?? new ProductVariantRepository(client),
    };
  }

  async projectForCustomer(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly viewerCustomerId: CustomerId;
    readonly now?: string;
  }): Promise<ForYouRankingResult> {
    const now = args.now ?? new Date().toISOString();

    const [
      consent,
      events,
      profile,
      facts,
      wishlist,
      orders,
      wardrobeItems,
      upcomingOccasions,
      products,
    ] = await Promise.all([
      this.deps.consent.getState(args.retailerId, args.customerId),
      this.deps.analytics.findRecentByCustomer(
        args.retailerId,
        args.customerId,
        FOR_YOU_EVENT_LIMIT,
      ),
      this.deps.styleProfile.findByCustomer(args.retailerId, args.customerId),
      this.deps.facts.listForCustomer(args.retailerId, args.customerId),
      this.deps.wishlist.findByCustomer(args.customerId),
      this.deps.orders.findByCustomer(args.customerId),
      this.deps.wardrobe.findByCustomer(args.customerId),
      this.loadUpcomingMoments(args.retailerId, args.customerId, now),
      this.deps.products.findByRetailer(args.retailerId),
    ]);

    const roadmaps = await this.deps.wardrobeRoadmaps.findByCustomer(
      args.customerId,
      { customerVisibleOnly: true },
    );
    const approvedRoadmap = roadmaps.find(
      (roadmap) => roadmap.status === "approved",
    );

    const wishlistItems = wishlist
      ? await this.deps.wishlist.findItems(wishlist.id)
      : [];

    const wishlistProductIds = new Set<string>();
    for (const item of wishlistItems) {
      const variant = await this.deps.variants.findById(item.productVariantId);
      if (variant) wishlistProductIds.add(String(variant.productId));
    }

    const purchasedProductIds = new Set<string>();
    for (const order of orders) {
      const lines = await this.deps.orders.findLinesByOrder(order.id);
      for (const line of lines) {
        const variant = await this.deps.variants.findById(
          line.productVariantId,
        );
        if (variant) purchasedProductIds.add(String(variant.productId));
      }
    }

    const ownedProductIds = new Set<string>(
      wardrobeItems
        .filter((item) => !item.deletedAt && !item.retiredAt && item.productId)
        .map((item) => String(item.productId)),
    );

    const eventSignals = forYouRecentProductIdsFromEvents(events);

    const rejectedConceptIds = new Set(
      facts
        .filter((fact) => fact.factType === "rejected_concept")
        .map((fact) => String(fact.valueConceptId ?? ""))
        .filter(Boolean),
    );

    const advisorFactConceptIds = new Set(
      facts
        .filter(
          (fact) =>
            fact.provenanceClass === "advisor_observed" ||
            fact.provenanceClass === "customer_declared",
        )
        .map((fact) => String(fact.valueConceptId ?? ""))
        .filter(Boolean),
    );

    let styleProfile: ForYouStyleSignals | null = null;
    if (profile) {
      styleProfile = {
        declaredConceptIds: profile.explicitPreferences.map((pref) =>
          String(pref.conceptId),
        ),
        inferredPositiveConceptIds: profile.inferredPreferences
          .filter((pref) => pref.polarity === "positive")
          .map((pref) => String(pref.conceptId)),
        inferredNegativeConceptIds: profile.inferredPreferences
          .filter((pref) => pref.polarity === "negative")
          .map((pref) => String(pref.conceptId)),
      };
    }

    const wardrobeGaps: ForYouWardrobeGap[] =
      approvedRoadmap?.gaps.map((gap) => ({
        gapId: String(gap.id),
        title: gap.title,
        rank: gap.rank,
        ...(gap.categoryCode ? { categoryCode: gap.categoryCode } : {}),
        ...(gap.slotKind ? { slotKind: gap.slotKind } : {}),
      })) ?? [];

    const activeProducts = products
      .filter((product) => product.status === "active" && !product.deletedAt)
      .slice(0, FOR_YOU_CATALOGUE_LIMIT);

    const productIds = activeProducts.map((product) => product.id);
    const metadataByProduct = await this.loadProductMetadata(
      args.retailerId,
      productIds,
    );

    const candidates: ForYouCandidate[] = [];
    for (const product of activeProducts) {
      const variants = await this.deps.variants.findByProduct(product.id);
      const inStock =
        variants.find((variant) => variant.inventoryQuantity > 0) ??
        variants[0];
      const metadata = metadataByProduct.get(String(product.id));
      candidates.push({
        productId: product.id,
        ...(inStock ? { productVariantId: inStock.id } : {}),
        displayName: product.name,
        productSlug: product.slug,
        ...(product.primaryImageUrl
          ? { primaryImageUrl: product.primaryImageUrl }
          : {}),
        acceptedConceptIds: metadata?.acceptedConceptIds ?? [],
        ...(metadata?.garmentTypeConceptId
          ? { garmentTypeConceptId: metadata.garmentTypeConceptId }
          : {}),
        ...(metadata?.categoryCode
          ? { categoryCode: metadata.categoryCode }
          : {}),
        available: Boolean(inStock && inStock.inventoryQuantity > 0),
      });
    }

    return rankForYouRecommendations(
      {
        retailerId: args.retailerId,
        customerId: args.customerId,
        viewerCustomerId: args.viewerCustomerId,
        now,
        consent,
        ownedProductIds,
        purchasedProductIds,
        wishlistProductIds,
        skippedProductIds: eventSignals.skipped,
        dismissedProductIds: eventSignals.dismissed,
        rejectedConceptIds,
        recentViewedProductIds: eventSignals.viewed,
        tieMateSavedConceptIds: eventSignals.tieMateConceptIds,
        styleProfile,
        wardrobeGaps,
        upcomingOccasions,
        advisorFactConceptIds,
      },
      candidates,
    );
  }

  private async loadUpcomingMoments(
    retailerId: RetailerId,
    customerId: CustomerId,
    now: string,
  ): Promise<string[]> {
    const { data, error } = await this.client
      .from("customer_moments")
      .select("label, occurs_on")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .gte("occurs_on", now.slice(0, 10))
      .order("occurs_on", { ascending: true })
      .limit(5);
    if (error) throw error;
    return data.map((row) => row.label);
  }

  private async loadProductMetadata(
    retailerId: RetailerId,
    productIds: readonly string[],
  ): Promise<
    Map<
      string,
      {
        readonly acceptedConceptIds: MetadataConceptId[];
        readonly garmentTypeConceptId?: MetadataConceptId;
        readonly categoryCode?: GarmentCategoryCode;
      }
    >
  > {
    if (productIds.length === 0) return new Map();

    const [{ data: variants, error: variantError }, assignments] =
      await Promise.all([
        this.client
          .from("product_variants")
          .select("id, product_id")
          .in("product_id", [...productIds])
          .is("deleted_at", null),
        this.loadAcceptedAssignments(retailerId),
      ]);
    if (variantError) throw variantError;

    const variantToProduct = new Map(
      variants.map((row) => [row.id, row.product_id]),
    );

    const conceptIds = new Set<string>();
    const conceptsByProduct = new Map<string, Set<string>>();

    for (const assignment of assignments) {
      if (assignment.review_status !== "accepted") continue;
      let productId: string | null = null;
      if (assignment.target_type === "product") {
        productId = assignment.target_id;
      } else if (assignment.target_type === "product_variant") {
        productId = variantToProduct.get(assignment.target_id) ?? null;
      }
      if (!productId || !productIds.includes(productId)) continue;
      conceptIds.add(assignment.concept_id);
      const set = conceptsByProduct.get(productId) ?? new Set<string>();
      set.add(assignment.concept_id);
      conceptsByProduct.set(productId, set);
    }

    const concepts = await this.loadConceptsByIds(retailerId, conceptIds);
    const result = new Map<
      string,
      {
        acceptedConceptIds: MetadataConceptId[];
        garmentTypeConceptId?: MetadataConceptId;
        categoryCode?: GarmentCategoryCode;
      }
    >();

    for (const [productId, conceptIdSet] of conceptsByProduct) {
      const acceptedConceptIds: MetadataConceptId[] = [];
      let garmentTypeConceptId: MetadataConceptId | undefined;
      let categoryCode: GarmentCategoryCode | undefined;

      for (const conceptId of conceptIdSet) {
        const concept = concepts.get(conceptId);
        if (!concept) continue;
        acceptedConceptIds.push(asId<"MetadataConceptId">(concept.id));
        if (concept.kind === "garment_type") {
          garmentTypeConceptId = asId<"MetadataConceptId">(concept.id);
          if (isGarmentCategory(concept.slug)) {
            categoryCode = concept.slug;
          }
        }
      }

      if (acceptedConceptIds.length > 0) {
        result.set(productId, {
          acceptedConceptIds,
          ...(garmentTypeConceptId ? { garmentTypeConceptId } : {}),
          ...(categoryCode ? { categoryCode } : {}),
        });
      }
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
