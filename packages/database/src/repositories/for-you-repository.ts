/**
 * For You projection repository (CLI-007 / PHASE 7.6).
 */

import {
  rankForYouCandidates,
  type CustomerId,
  type ForYouProjection,
  type ProductId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

import { CatalogueQueryRepository } from "./catalogue-query-repository";
import { CustomerConsentRepository } from "./customer-consent-repository";
import { CustomerFactRepository } from "./customer-fact-repository";
import { CustomerInterestRepository } from "./customer-interest-repository";
import { ProductRepository } from "./product-repository";
import { ProductVariantRepository } from "./product-variant-repository";
import { StyleProfileRepository } from "./style-profile-repository";
import { WardrobeRepository } from "./wardrobe-repository";
import { WishlistRepository } from "./wishlist-repository";

export class ForYouRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async projectForCustomer(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly limit?: number;
  }): Promise<ForYouProjection> {
    const consent = await new CustomerConsentRepository(this.client).getState(
      args.retailerId,
      args.customerId,
    );
    if (!consent || consent.personalization.status !== "granted") {
      return {
        projectorVersion: "for-you-v1",
        items: [],
        suppressedOwned: 0,
        suppressedRejected: 0,
        suppressedOutOfStock: 0,
      };
    }

    const [
      products,
      wishlist,
      facts,
      interest,
      wardrobeItems,
      styleProfile,
      catalogueCandidates,
    ] = await Promise.all([
      new ProductRepository(this.client).findByRetailer(args.retailerId),
      new WishlistRepository(this.client).findByCustomer(args.customerId),
      new CustomerFactRepository(this.client).listForCustomer(
        args.retailerId,
        args.customerId,
        80,
      ),
      new CustomerInterestRepository(this.client).projectForCustomer({
        retailerId: args.retailerId,
        customerId: args.customerId,
        viewerRetailerId: args.retailerId,
      }),
      new WardrobeRepository(this.client).findByCustomer(args.customerId),
      new StyleProfileRepository(this.client).findByCustomer(
        args.retailerId,
        args.customerId,
      ),
      new CatalogueQueryRepository(this.client).projectCandidates(
        args.retailerId,
      ),
    ]);

    const wishlistProductIds = new Set<string>();
    const variantRepo = new ProductVariantRepository(this.client);
    if (wishlist) {
      const items = await new WishlistRepository(this.client).findItems(
        wishlist.id,
      );
      await Promise.all(
        items.map(async (item) => {
          const variant = await variantRepo.findById(item.productVariantId);
          if (variant) wishlistProductIds.add(variant.productId);
        }),
      );
    }

    const ownedProductIds = new Set(
      wardrobeItems
        .map((item) => item.productId)
        .filter((id): id is ProductId => Boolean(id)),
    );

    const rejectedLabels = new Set(
      facts
        .filter((fact) => fact.factType === "rejected_concept")
        .map((fact) => fact.valueLabel.toLowerCase()),
    );
    const advisorLabels = new Set(
      facts
        .filter(
          (fact) =>
            fact.provenanceClass === "advisor_observed" &&
            fact.factType !== "rejected_concept",
        )
        .map((fact) => fact.valueLabel.toLowerCase()),
    );
    const declaredLabels = new Set(
      facts
        .filter((fact) => fact.provenanceClass === "customer_declared")
        .map((fact) => fact.valueLabel.toLowerCase()),
    );
    const positiveInterestConceptIds = new Set(
      interest.visibility === "usable"
        ? interest.insights
            .filter((insight) => insight.polarity === "positive")
            .flatMap((insight) => [
              insight.attributeConceptId,
              insight.scopeConceptId,
            ])
        : [],
    );
    const positiveInferredConceptIds = new Set(
      styleProfile?.inferredPreferences
        .filter((preference) => preference.polarity === "positive")
        .map((preference) => preference.conceptId) ?? [],
    );
    const negativeInferredConceptIds = new Set(
      styleProfile?.inferredPreferences
        .filter((preference) => preference.polarity === "negative")
        .map((preference) => preference.conceptId) ?? [],
    );
    const positiveDeclaredConceptIds = new Set(
      styleProfile?.explicitPreferences
        .filter((preference) => preference.polarity === "positive")
        .map((preference) => preference.conceptId) ?? [],
    );
    const negativeDeclaredConceptIds = new Set(
      styleProfile?.explicitPreferences
        .filter((preference) => preference.polarity === "negative")
        .map((preference) => preference.conceptId) ?? [],
    );
    const acceptedConceptIdsByProduct = new Map(
      catalogueCandidates.map((candidate) => [
        candidate.productId,
        new Set(candidate.acceptedConceptIds),
      ]),
    );
    const occasionLabels = new Set(
      facts
        .filter((fact) => fact.factType === "occasion")
        .map((fact) => fact.valueLabel.toLowerCase()),
    );

    const activeProducts = products.filter(
      (product) =>
        product.retailerId === args.retailerId && product.status === "active",
    );

    const stockByProduct = new Map<string, boolean>();
    await Promise.all(
      activeProducts.slice(0, 80).map(async (product) => {
        const variants = await variantRepo.findByProduct(product.id);
        stockByProduct.set(
          product.id,
          variants.some((variant) => variant.inventoryQuantity > 0) ||
            product.isMadeToOrder,
        );
      }),
    );

    const candidates = activeProducts.slice(0, 80).map((product) => {
      const titleLower = product.name.toLowerCase();
      const matches = (labels: Set<string>) =>
        [...labels].some((label) => titleLower.includes(label));
      const acceptedConceptIds =
        acceptedConceptIdsByProduct.get(product.id) ?? new Set();
      const sharesConceptWith = (conceptIds: ReadonlySet<string>) =>
        [...acceptedConceptIds].some((conceptId) => conceptIds.has(conceptId));
      return {
        productId: product.id,
        retailerId: product.retailerId,
        title: product.name,
        conceptLabels: [...acceptedConceptIds],
        inStock: stockByProduct.get(product.id) ?? true,
        owned: ownedProductIds.has(product.id),
        rejected:
          matches(rejectedLabels) ||
          sharesConceptWith(negativeInferredConceptIds) ||
          sharesConceptWith(negativeDeclaredConceptIds),
        onWishlist: wishlistProductIds.has(product.id),
        tieMateSaved: false,
        advisorMatched: matches(advisorLabels),
        declaredMatched:
          matches(declaredLabels) ||
          sharesConceptWith(positiveDeclaredConceptIds),
        interestMatched:
          sharesConceptWith(positiveInterestConceptIds) ||
          sharesConceptWith(positiveInferredConceptIds),
        wardrobeGapMatched: false,
        occasionMatched: matches(occasionLabels),
        recentBehaviourMatched:
          interest.visibility === "usable" && interest.insights.length > 0,
      };
    });

    const ranked = rankForYouCandidates({
      candidates,
      limit: args.limit ?? 12,
    });
    const slugById = new Map(
      activeProducts.map((product) => [product.id, product.slug] as const),
    );
    return {
      ...ranked,
      items: ranked.items.map((item) => {
        const productSlug = slugById.get(item.productId);
        return productSlug ? { ...item, productSlug } : item;
      }),
    };
  }
}
