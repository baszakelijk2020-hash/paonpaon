/**
 * Retailer-scoped advisor preparation brief projection (ADV-003 /
 * PHASE 3.3). Loads consented StyleProfile/events/wishlist/conversation
 * sources and builds the deterministic domain brief.
 */

import {
  asId,
  buildAdvisorPreparationBrief,
  projectAdvisorBriefWardrobeGaps,
  type AdvisorBriefResolvedWishlistItem,
  type AdvisorPreparationBrief,
  type CustomerId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

import { AnalyticsRepository } from "./analytics-repository";
import { CustomerConsentRepository } from "./customer-consent-repository";
import { KnowledgeRepository } from "./knowledge-repository";
import { MessagingRepository } from "./messaging-repository";
import { MetadataRepository } from "./metadata-repository";
import { ProductRepository } from "./product-repository";
import { ProductVariantRepository } from "./product-variant-repository";
import { StyleProfileRepository } from "./style-profile-repository";
import { WardrobeRoadmapRepository } from "./wardrobe-roadmap-repository";
import { WishlistRepository } from "./wishlist-repository";

export interface AdvisorBriefRepositoryDeps {
  readonly consent: CustomerConsentRepository;
  readonly analytics: AnalyticsRepository;
  readonly styleProfile: StyleProfileRepository;
  readonly wishlist: WishlistRepository;
  readonly messaging: MessagingRepository;
  readonly products: ProductRepository;
  readonly variants: ProductVariantRepository;
  readonly metadata: MetadataRepository;
  readonly knowledge: KnowledgeRepository;
  readonly wardrobeRoadmap: WardrobeRoadmapRepository;
}

function asUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return null;
  }
  return value;
}

export class AdvisorBriefRepository {
  private readonly deps: AdvisorBriefRepositoryDeps;

  constructor(
    client: PaonSupabaseClient,
    deps?: Partial<AdvisorBriefRepositoryDeps>,
  ) {
    this.deps = {
      consent: deps?.consent ?? new CustomerConsentRepository(client),
      analytics: deps?.analytics ?? new AnalyticsRepository(client),
      styleProfile: deps?.styleProfile ?? new StyleProfileRepository(client),
      wishlist: deps?.wishlist ?? new WishlistRepository(client),
      messaging: deps?.messaging ?? new MessagingRepository(client),
      products: deps?.products ?? new ProductRepository(client),
      variants: deps?.variants ?? new ProductVariantRepository(client),
      metadata: deps?.metadata ?? new MetadataRepository(client),
      knowledge: deps?.knowledge ?? new KnowledgeRepository(client),
      wardrobeRoadmap:
        deps?.wardrobeRoadmap ?? new WardrobeRoadmapRepository(client),
    };
  }

  /**
   * Project the advisor preparation brief for one retailer-customer
   * relationship. `advisorRetailerId` must match `retailerId`; domain
   * rules fail closed otherwise.
   */
  async projectForCustomer(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly advisorRetailerId: RetailerId;
    readonly appointmentNotes?: string;
    readonly now?: string;
  }): Promise<AdvisorPreparationBrief> {
    const now = args.now ?? new Date().toISOString();

    const [
      consent,
      events,
      profile,
      evidence,
      wishlist,
      conversation,
      roadmap,
    ] = await Promise.all([
      this.deps.consent.getState(args.retailerId, args.customerId),
      this.deps.analytics.findRecentByCustomer(
        args.retailerId,
        args.customerId,
        40,
      ),
      this.deps.styleProfile.findByCustomer(args.retailerId, args.customerId),
      this.deps.styleProfile.listEvidence(args.customerId, {
        includeSuppressed: false,
        limit: 40,
      }),
      this.deps.wishlist.findByCustomer(args.customerId),
      this.deps.messaging.findByCustomer(args.customerId),
      this.deps.wardrobeRoadmap.findApprovedByCustomer(args.customerId),
    ]);

    const wishlistItems = wishlist
      ? await this.deps.wishlist.findItems(wishlist.id)
      : [];

    const messages = conversation
      ? await this.deps.messaging.findMessages(conversation.id)
      : [];

    const productIds = new Set<string>();
    const variantIds = new Set<string>();
    const conceptIds = new Set<string>();
    const knowledgeIds = new Set<string>();

    for (const item of wishlistItems) {
      variantIds.add(item.productVariantId);
    }
    for (const event of events) {
      const productId = asUuid(event.properties.productId);
      const variantId = asUuid(event.properties.productVariantId);
      const conceptId = asUuid(event.properties.conceptId);
      const knowledgeId =
        asUuid(event.properties.knowledgeObjectId) ??
        asUuid(event.properties.knowledgeId);
      if (productId) productIds.add(productId);
      if (variantId) variantIds.add(variantId);
      if (conceptId) conceptIds.add(conceptId);
      if (knowledgeId) knowledgeIds.add(knowledgeId);
      if (Array.isArray(event.properties.conceptIds)) {
        for (const value of event.properties.conceptIds) {
          const id = asUuid(value);
          if (id) conceptIds.add(id);
        }
      }
    }
    for (const row of evidence) {
      conceptIds.add(row.conceptId);
    }
    if (roadmap) {
      for (const gap of roadmap.gaps) {
        if (gap.productId) productIds.add(gap.productId);
        if (gap.knowledgeObjectId) knowledgeIds.add(gap.knowledgeObjectId);
      }
    }
    if (profile) {
      for (const row of profile.explicitPreferences) {
        conceptIds.add(row.conceptId);
      }
      for (const row of profile.inferredPreferences) {
        conceptIds.add(row.conceptId);
      }
    }

    const variantEntries = await Promise.all(
      [...variantIds].map(async (id) => {
        const variant = await this.deps.variants.findById(
          asId<"ProductVariantId">(id),
        );
        return [id, variant] as const;
      }),
    );
    const variantsById = new Map(variantEntries);
    for (const variant of variantsById.values()) {
      if (variant) productIds.add(variant.productId);
    }

    const [productEntries, conceptEntries, knowledgeEntries] =
      await Promise.all([
        Promise.all(
          [...productIds].map(async (id) => {
            const product = await this.deps.products.findById(
              asId<"ProductId">(id),
            );
            return [id, product] as const;
          }),
        ),
        Promise.all(
          [...conceptIds].map(async (id) => {
            const concept = await this.deps.metadata.findConceptById(
              args.retailerId,
              asId<"MetadataConceptId">(id),
            );
            return [id, concept] as const;
          }),
        ),
        Promise.all(
          [...knowledgeIds].map(async (id) => {
            const object = await this.deps.knowledge.findById(
              args.retailerId,
              asId<"KnowledgeObjectId">(id),
            );
            return [id, object] as const;
          }),
        ),
      ]);

    const productsById = new Map(productEntries);
    const productLabels = new Map<string, string>();
    for (const [id, product] of productsById) {
      if (product && product.retailerId === args.retailerId) {
        productLabels.set(id, product.name);
      }
    }

    const conceptLabels = new Map<string, string>();
    for (const [id, concept] of conceptEntries) {
      if (concept) conceptLabels.set(id, concept.canonicalName);
    }

    const knowledgeLabels = new Map<string, string>();
    for (const [id, object] of knowledgeEntries) {
      if (object) knowledgeLabels.set(id, object.title);
    }

    const resolvedWishlist: AdvisorBriefResolvedWishlistItem[] = [];
    for (const item of wishlistItems) {
      const variant = variantsById.get(item.productVariantId);
      if (!variant) continue;
      const product = productsById.get(variant.productId);
      if (!product || product.retailerId !== args.retailerId) continue;
      const parts = [product.name];
      if (variant.size) parts.push(variant.size);
      if (variant.color) parts.push(variant.color);
      resolvedWishlist.push({
        productVariantId: item.productVariantId,
        productId: variant.productId,
        label: parts.join(" / "),
        addedAt: item.addedAt,
      });
    }

    const wardrobeGaps = projectAdvisorBriefWardrobeGaps(roadmap, {
      ruleTitles: knowledgeLabels,
      productLabels,
    });

    return buildAdvisorPreparationBrief({
      retailerId: args.retailerId,
      customerId: args.customerId,
      advisorRetailerId: args.advisorRetailerId,
      now,
      consent,
      events,
      profile,
      evidence,
      conceptLabels,
      productLabels,
      knowledgeLabels,
      wishlistItems: resolvedWishlist,
      wardrobeGaps,
      ...(conversation
        ? {
            conversationId: conversation.id,
            ...(conversation.intent
              ? { conversationIntent: conversation.intent }
              : {}),
          }
        : {}),
      messages,
      ...(args.appointmentNotes
        ? { appointmentNotes: args.appointmentNotes }
        : {}),
    });
  }
}
