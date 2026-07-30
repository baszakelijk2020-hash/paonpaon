import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  DEFAULT_FOR_YOU_MAX_RECOMMENDATIONS,
  FOR_YOU_PROJECTOR_VERSION,
  forYouRecentProductIdsFromEvents,
  rankForYouRecommendations,
  type ForYouCandidate,
  type ForYouRankingInput,
} from "./for-you";
import type { BehavioralEvent } from "./interaction-event";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const brownId = asId<"MetadataConceptId">(
  "55555555-5555-4555-8555-555555555555",
);
const suitTypeId = asId<"MetadataConceptId">(
  "44444444-4444-4444-8444-444444444444",
);
const now = "2026-07-30T12:00:00.000Z";

function grantedConsent() {
  return {
    retailerId,
    customerId,
    personalization: {
      purpose: "personalization" as const,
      status: "granted" as const,
      grantedAt: "2026-01-01T00:00:00.000Z",
    },
    marketing: { purpose: "marketing" as const, status: "denied" as const },
    location: { purpose: "location" as const, status: "denied" as const },
    updatedAt: now,
  };
}

function productId(n: number): ReturnType<typeof asId<"ProductId">> {
  return asId<"ProductId">(
    `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`,
  );
}

function candidate(args: {
  readonly n: number;
  readonly slug: string;
  readonly concepts?: readonly ReturnType<typeof asId<"MetadataConceptId">>[];
  readonly garmentType?: ReturnType<typeof asId<"MetadataConceptId">>;
  readonly available?: boolean;
  readonly categoryCode?: ForYouCandidate["categoryCode"];
}): ForYouCandidate {
  return {
    productId: productId(args.n),
    productVariantId: asId<"ProductVariantId">(
      `cccccccc-cccc-4ccc-8ccc-${String(args.n).padStart(12, "0")}`,
    ),
    displayName: `Product ${args.n}`,
    productSlug: args.slug,
    acceptedConceptIds: args.concepts ?? [],
    ...(args.garmentType ? { garmentTypeConceptId: args.garmentType } : {}),
    ...(args.categoryCode ? { categoryCode: args.categoryCode } : {}),
    available: args.available ?? true,
  };
}

function baseInput(
  overrides?: Partial<ForYouRankingInput>,
): ForYouRankingInput {
  return {
    retailerId,
    customerId,
    viewerCustomerId: customerId,
    now,
    consent: grantedConsent(),
    ownedProductIds: new Set(),
    purchasedProductIds: new Set(),
    wishlistProductIds: new Set(),
    skippedProductIds: new Set(),
    dismissedProductIds: new Set(),
    rejectedConceptIds: new Set(),
    recentViewedProductIds: new Set(),
    tieMateSavedConceptIds: new Set(),
    styleProfile: null,
    wardrobeGaps: [],
    upcomingOccasions: [],
    advisorFactConceptIds: new Set(),
    ...overrides,
  };
}

describe("rankForYouRecommendations", () => {
  it("returns versioned usable recommendations with reason copy", () => {
    const result = rankForYouRecommendations(
      baseInput({
        wishlistProductIds: new Set([String(productId(1))]),
        styleProfile: {
          declaredConceptIds: [String(brownId)],
          inferredPositiveConceptIds: [],
          inferredNegativeConceptIds: [],
        },
      }),
      [
        candidate({
          n: 1,
          slug: "brown-suit",
          concepts: [brownId],
          garmentType: suitTypeId,
          categoryCode: "suit",
        }),
        candidate({
          n: 2,
          slug: "navy-jacket",
          garmentType: suitTypeId,
          categoryCode: "jacket",
        }),
      ],
    );

    expect(result.version).toBe(FOR_YOU_PROJECTOR_VERSION);
    expect(result.visibility).toBe("usable");
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0]?.productId).toBe(productId(1));
    expect(result.recommendations[0]?.statement).toContain("saved list");
    expect(
      result.recommendations[0]?.factors.some(
        (factor) => factor.code === "wishlist_affinity",
      ),
    ).toBe(true);
  });

  it("suppresses owned, purchased, rejected, dismissed, and out-of-stock items", () => {
    const rejected = asId<"MetadataConceptId">(
      "77777777-7777-4777-8777-777777777777",
    );
    const result = rankForYouRecommendations(
      baseInput({
        ownedProductIds: new Set([String(productId(1))]),
        purchasedProductIds: new Set([String(productId(2))]),
        dismissedProductIds: new Set([String(productId(3))]),
        rejectedConceptIds: new Set([String(rejected)]),
      }),
      [
        candidate({ n: 1, slug: "owned" }),
        candidate({ n: 2, slug: "purchased" }),
        candidate({ n: 3, slug: "dismissed" }),
        candidate({ n: 4, slug: "rejected", concepts: [rejected] }),
        candidate({ n: 5, slug: "oos", available: false }),
        candidate({ n: 6, slug: "eligible" }),
      ],
    );

    expect(result.suppressedCount).toBe(5);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]?.productSlug).toBe("eligible");
  });

  it("suppresses skipped products", () => {
    const result = rankForYouRecommendations(
      baseInput({
        skippedProductIds: new Set([String(productId(1))]),
        styleProfile: {
          declaredConceptIds: [],
          inferredPositiveConceptIds: [],
          inferredNegativeConceptIds: [String(brownId)],
        },
      }),
      [
        candidate({ n: 1, slug: "skipped", concepts: [brownId] }),
        candidate({ n: 2, slug: "clean" }),
      ],
    );

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]?.productSlug).toBe("clean");
  });

  it("respects consent withdrawal with empty recommendations", () => {
    const result = rankForYouRecommendations(
      baseInput({
        consent: {
          ...grantedConsent(),
          personalization: {
            purpose: "personalization",
            status: "withdrawn",
            withdrawnAt: now,
          },
        },
      }),
      [candidate({ n: 1, slug: "one" })],
    );

    expect(result.visibility).toBe("consent_withdrawn");
    expect(result.recommendations).toHaveLength(0);
  });

  it("limits results and applies category diversity", () => {
    const result = rankForYouRecommendations(
      baseInput({ maxRecommendations: 3 }),
      [
        candidate({
          n: 1,
          slug: "suit-a",
          garmentType: suitTypeId,
          categoryCode: "suit",
        }),
        candidate({
          n: 2,
          slug: "suit-b",
          garmentType: suitTypeId,
          categoryCode: "suit",
        }),
        candidate({
          n: 3,
          slug: "suit-c",
          garmentType: suitTypeId,
          categoryCode: "suit",
        }),
        candidate({
          n: 4,
          slug: "shirt-a",
          categoryCode: "shirt",
        }),
      ],
    );

    expect(result.recommendations.length).toBeLessThanOrEqual(3);
    expect(result.recommendations.length).toBeGreaterThan(0);
    const suitCount = result.recommendations.filter(
      (item) => item.productSlug.startsWith("suit"),
    ).length;
    expect(suitCount).toBeLessThanOrEqual(2);
  });

  it("boosts wardrobe gap matches", () => {
    const result = rankForYouRecommendations(
      baseInput({
        wardrobeGaps: [
          { gapId: "gap-1", title: "Evening jacket", rank: 1, categoryCode: "jacket" },
        ],
      }),
      [
        candidate({ n: 1, slug: "shirt", categoryCode: "shirt" }),
        candidate({ n: 2, slug: "jacket", categoryCode: "jacket" }),
      ],
    );

    expect(result.recommendations[0]?.productSlug).toBe("jacket");
    expect(
      result.recommendations[0]?.factors.some(
        (factor) => factor.code === "wardrobe_gap_fill",
      ),
    ).toBe(true);
  });

  it("fails closed for cross-customer viewer", () => {
    const otherCustomer = asId<"CustomerId">(
      "99999999-9999-4999-8999-999999999999",
    );
    const result = rankForYouRecommendations(
      baseInput({ viewerCustomerId: otherCustomer }),
      [candidate({ n: 1, slug: "one" })],
    );
    expect(result.visibility).toBe("empty");
    expect(result.recommendations).toHaveLength(0);
  });

  it("defaults max recommendations", () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      candidate({ n: index + 1, slug: `p-${index + 1}` }),
    );
    const result = rankForYouRecommendations(baseInput(), many);
    expect(result.recommendations.length).toBe(
      DEFAULT_FOR_YOU_MAX_RECOMMENDATIONS,
    );
  });
});

describe("forYouRecentProductIdsFromEvents", () => {
  it("extracts viewed, skipped, dismissed, and tie-mate concept ids", () => {
    const events: BehavioralEvent[] = [
      {
        retailerId,
        customerId,
        name: "product_viewed",
        properties: { productId: productId(1) },
        occurredAt: now,
        source: "customer_portal",
        purpose: "personalization",
        consentBasis: "explicit_opt_in",
        consentSnapshot: {
          personalization: "granted",
          marketing: "denied",
          location: "denied",
          capturedAt: now,
          basis: "explicit_opt_in",
        },
        retentionClass: "personalization_signal",
        retentionExpiresAt: now,
      },
      {
        retailerId,
        customerId,
        name: "product_skipped",
        properties: { productId: productId(2) },
        occurredAt: now,
        source: "customer_portal",
        purpose: "personalization",
        consentBasis: "explicit_opt_in",
        consentSnapshot: {
          personalization: "granted",
          marketing: "denied",
          location: "denied",
          capturedAt: now,
          basis: "explicit_opt_in",
        },
        retentionClass: "personalization_signal",
        retentionExpiresAt: now,
      },
      {
        retailerId,
        customerId,
        name: "for_you_dismissed",
        properties: { productId: productId(3) },
        occurredAt: now,
        source: "customer_portal",
        purpose: "personalization",
        consentBasis: "explicit_opt_in",
        consentSnapshot: {
          personalization: "granted",
          marketing: "denied",
          location: "denied",
          capturedAt: now,
          basis: "explicit_opt_in",
        },
        retentionClass: "personalization_signal",
        retentionExpiresAt: now,
      },
      {
        retailerId,
        customerId,
        name: "product_favorited",
        properties: {
          productId: productId(4),
          via: "tie_mate",
          conceptId: String(brownId),
        },
        occurredAt: now,
        source: "customer_portal",
        purpose: "personalization",
        consentBasis: "explicit_opt_in",
        consentSnapshot: {
          personalization: "granted",
          marketing: "denied",
          location: "denied",
          capturedAt: now,
          basis: "explicit_opt_in",
        },
        retentionClass: "personalization_signal",
        retentionExpiresAt: now,
      },
    ];

    const extracted = forYouRecentProductIdsFromEvents(events);
    expect(extracted.viewed.has(String(productId(1)))).toBe(true);
    expect(extracted.skipped.has(String(productId(2)))).toBe(true);
    expect(extracted.dismissed.has(String(productId(3)))).toBe(true);
    expect(extracted.tieMateConceptIds.has(String(brownId))).toBe(true);
  });
});
