/**
 * Retailer-scoped advisor preparation brief loader (ADV-003 / PHASE 3.3).
 * Composes existing intelligence repositories into one explainable projection.
 */

import {
  asId,
  buildAdvisorPreparationBrief,
  type AdvisorPreparationBrief,
  type AdvisorBriefShortlistItem,
  type CustomerId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

import { AnalyticsRepository } from "./analytics-repository";
import { CustomerConsentRepository } from "./customer-consent-repository";
import { CustomerPreferencesRepository } from "./customer-preferences-repository";
import { KnowledgeRepository } from "./knowledge-repository";
import { MessagingRepository } from "./messaging-repository";
import { MetadataRepository } from "./metadata-repository";
import { ProductRepository } from "./product-repository";
import { ProductVariantRepository } from "./product-variant-repository";
import { StyleProfileRepository } from "./style-profile-repository";
import { WishlistRepository } from "./wishlist-repository";

export interface AdvisorBriefLoadInput {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly now?: string;
  readonly appointmentNotes?: string;
}

export class AdvisorBriefRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async loadForCustomer(
    input: AdvisorBriefLoadInput,
  ): Promise<AdvisorPreparationBrief> {
    const now = input.now ?? new Date().toISOString();
    const consentRepo = new CustomerConsentRepository(this.client);
    const analyticsRepo = new AnalyticsRepository(this.client);
    const styleRepo = new StyleProfileRepository(this.client);
    const preferencesRepo = new CustomerPreferencesRepository(this.client);
    const messagingRepo = new MessagingRepository(this.client);
    const wishlistRepo = new WishlistRepository(this.client);
    const variantRepo = new ProductVariantRepository(this.client);
    const productRepo = new ProductRepository(this.client);
    const metadataRepo = new MetadataRepository(this.client);
    const knowledgeRepo = new KnowledgeRepository(this.client);

    const [consent, events, profile, evidence, preferences, conversation] =
      await Promise.all([
        consentRepo.getState(input.retailerId, input.customerId),
        analyticsRepo.findRecentByCustomer(
          input.retailerId,
          input.customerId,
          50,
        ),
        styleRepo.findByCustomer(input.retailerId, input.customerId),
        styleRepo.listEvidence(input.customerId, { limit: 20 }),
        preferencesRepo.findByCustomer(input.customerId),
        messagingRepo.findByCustomer(input.customerId),
      ]);

    const messages = conversation
      ? await messagingRepo.findMessages(conversation.id)
      : [];

    const customerMessages = messages
      .filter((message) => message.senderType === "customer")
      .map((message) => ({ body: message.body, createdAt: message.createdAt }));
    const staffMessages = messages
      .filter((message) => message.senderType === "staff")
      .map((message) => ({ body: message.body, createdAt: message.createdAt }));

    const shortlistItems = await this.resolveShortlist(
      input.customerId,
      wishlistRepo,
      variantRepo,
      productRepo,
    );

    const conceptIds = new Set<string>();
    for (const row of profile?.explicitPreferences ?? []) {
      conceptIds.add(row.conceptId);
    }
    for (const row of profile?.inferredPreferences ?? []) {
      conceptIds.add(row.conceptId);
    }
    for (const row of evidence) {
      conceptIds.add(row.conceptId);
    }

    const productIds = new Set<string>();
    for (const event of events) {
      const productId = event.properties.productId;
      if (typeof productId === "string") productIds.add(productId);
    }
    for (const item of shortlistItems) {
      productIds.add(item.productId);
    }

    const knowledgeObjectIds = new Set<string>();
    for (const event of events) {
      if (event.name !== "knowledge_opened") continue;
      const knowledgeObjectId = event.properties.knowledgeObjectId;
      if (typeof knowledgeObjectId === "string") {
        knowledgeObjectIds.add(knowledgeObjectId);
      }
    }

    const [conceptLabels, productNames, knowledgeTitles] = await Promise.all([
      this.resolveConceptLabels(metadataRepo, input.retailerId, [
        ...conceptIds,
      ]),
      this.resolveProductNames(productRepo, [...productIds]),
      this.resolveKnowledgeTitles(knowledgeRepo, input.retailerId, [
        ...knowledgeObjectIds,
      ]),
    ]);

    return buildAdvisorPreparationBrief({
      retailerId: input.retailerId,
      customerId: input.customerId,
      now,
      consent,
      events,
      profile,
      evidence,
      conceptLabels,
      productNames,
      knowledgeTitles,
      shortlistItems,
      customerMessages,
      staffMessages,
      ...(conversation?.intent
        ? { conversationIntent: conversation.intent }
        : {}),
      ...(preferences?.styleNotes
        ? { styleNotes: preferences.styleNotes }
        : {}),
      ...(input.appointmentNotes
        ? { appointmentNotes: input.appointmentNotes }
        : {}),
    });
  }

  private async resolveShortlist(
    customerId: CustomerId,
    wishlistRepo: WishlistRepository,
    variantRepo: ProductVariantRepository,
    productRepo: ProductRepository,
  ): Promise<AdvisorBriefShortlistItem[]> {
    const wishlist = await wishlistRepo.findByCustomer(customerId);
    if (!wishlist) return [];

    const items = await wishlistRepo.findItems(wishlist.id);
    const results: AdvisorBriefShortlistItem[] = [];
    for (const item of items) {
      const variant = await variantRepo.findById(item.productVariantId);
      const product = variant
        ? await productRepo.findById(variant.productId)
        : null;
      if (!variant || !product) continue;

      const variantLabel = [variant.size, variant.color]
        .filter(Boolean)
        .join(" · ");

      results.push({
        productId: product.id,
        productName: product.name,
        ...(variantLabel ? { variantLabel } : {}),
        savedAt: item.addedAt,
        source: "wishlist",
      });
    }
    return results;
  }

  private async resolveConceptLabels(
    metadataRepo: MetadataRepository,
    retailerId: RetailerId,
    conceptIds: readonly string[],
  ): Promise<Record<string, string>> {
    const labels: Record<string, string> = {};
    await Promise.all(
      conceptIds.map(async (conceptId) => {
        const concept = await metadataRepo.findConceptById(
          retailerId,
          asId<"MetadataConceptId">(conceptId),
        );
        if (concept) labels[conceptId] = concept.canonicalName;
      }),
    );
    return labels;
  }

  private async resolveProductNames(
    productRepo: ProductRepository,
    productIds: readonly string[],
  ): Promise<Record<string, string>> {
    const names: Record<string, string> = {};
    await Promise.all(
      productIds.map(async (productId) => {
        const product = await productRepo.findById(
          asId<"ProductId">(productId),
        );
        if (product) names[productId] = product.name;
      }),
    );
    return names;
  }

  private async resolveKnowledgeTitles(
    knowledgeRepo: KnowledgeRepository,
    retailerId: RetailerId,
    knowledgeObjectIds: readonly string[],
  ): Promise<Record<string, string>> {
    const titles: Record<string, string> = {};
    await Promise.all(
      knowledgeObjectIds.map(async (knowledgeObjectId) => {
        const object = await knowledgeRepo.findById(
          retailerId,
          asId<"KnowledgeObjectId">(knowledgeObjectId),
        );
        if (object) titles[knowledgeObjectId] = object.title;
      }),
    );
    return titles;
  }
}
