import { asId, type ForYouRankingResult } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { ForYouRepository } from "./for-you-repository";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const otherCustomerId = asId<"CustomerId">(
  "99999999-9999-4999-8999-999999999999",
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

function clientWithMoments(): PaonSupabaseClient {
  return {
    from: vi.fn((table: string) => {
      if (table === "customer_moments") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === "product_variants") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === "entity_metadata_assignments") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === "metadata_concepts") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  } as unknown as PaonSupabaseClient;
}

describe("ForYouRepository", () => {
  it("projects usable recommendations for consented customers", async () => {
    const productId = asId<"ProductId">(
      "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
    );
    const variantId = asId<"ProductVariantId">(
      "cccccccc-cccc-4ccc-8ccc-000000000001",
    );

    const repo = new ForYouRepository(clientWithMoments(), {
      consent: { getState: vi.fn().mockResolvedValue(grantedConsent()) },
      analytics: { findRecentByCustomer: vi.fn().mockResolvedValue([]) },
      styleProfile: { findByCustomer: vi.fn().mockResolvedValue(null) },
      facts: { listForCustomer: vi.fn().mockResolvedValue([]) },
      wishlist: {
        findByCustomer: vi.fn().mockResolvedValue(null),
        findItems: vi.fn().mockResolvedValue([]),
      },
      orders: { findByCustomer: vi.fn().mockResolvedValue([]) },
      wardrobe: { findByCustomer: vi.fn().mockResolvedValue([]) },
      wardrobeRoadmaps: {
        findByCustomer: vi.fn().mockResolvedValue([]),
      },
      products: {
        findByRetailer: vi.fn().mockResolvedValue([
          {
            id: productId,
            retailerId,
            name: "Brown suit",
            slug: "brown-suit",
            description: "",
            status: "active",
            isMadeToOrder: false,
            isAlterable: true,
            collectionIds: [],
            createdAt: now,
            updatedAt: now,
          },
        ]),
      },
      variants: {
        findByProduct: vi.fn().mockResolvedValue([
          {
            id: variantId,
            productId,
            sku: "SKU-1",
            size: "48",
            color: "Brown",
            priceMinor: 120000,
            inventoryQuantity: 2,
            createdAt: now,
            updatedAt: now,
          },
        ]),
        findById: vi.fn(),
      },
    } as never);

    const projection: ForYouRankingResult = await repo.projectForCustomer({
      retailerId,
      customerId,
      viewerCustomerId: customerId,
      now,
    });

    expect(projection.visibility).toBe("usable");
    expect(projection.recommendations).toHaveLength(1);
    expect(projection.recommendations[0]?.productSlug).toBe("brown-suit");
  });

  it("fails closed when viewer customer id does not match", async () => {
    const repo = new ForYouRepository(clientWithMoments(), {
      consent: { getState: vi.fn().mockResolvedValue(grantedConsent()) },
      analytics: { findRecentByCustomer: vi.fn().mockResolvedValue([]) },
      styleProfile: { findByCustomer: vi.fn().mockResolvedValue(null) },
      facts: { listForCustomer: vi.fn().mockResolvedValue([]) },
      wishlist: {
        findByCustomer: vi.fn().mockResolvedValue(null),
        findItems: vi.fn().mockResolvedValue([]),
      },
      orders: { findByCustomer: vi.fn().mockResolvedValue([]) },
      wardrobe: { findByCustomer: vi.fn().mockResolvedValue([]) },
      wardrobeRoadmaps: {
        findByCustomer: vi.fn().mockResolvedValue([]),
      },
      products: { findByRetailer: vi.fn().mockResolvedValue([]) },
      variants: {
        findByProduct: vi.fn().mockResolvedValue([]),
        findById: vi.fn(),
      },
    } as never);

    const projection = await repo.projectForCustomer({
      retailerId,
      customerId,
      viewerCustomerId: otherCustomerId,
      now,
    });

    expect(projection.visibility).toBe("empty");
    expect(projection.recommendations).toEqual([]);
  });

  it("returns consent_withdrawn without recommendations", async () => {
    const repo = new ForYouRepository(clientWithMoments(), {
      consent: {
        getState: vi.fn().mockResolvedValue({
          ...grantedConsent(),
          personalization: {
            purpose: "personalization",
            status: "withdrawn",
            withdrawnAt: now,
          },
        }),
      },
      analytics: { findRecentByCustomer: vi.fn().mockResolvedValue([]) },
      styleProfile: { findByCustomer: vi.fn().mockResolvedValue(null) },
      facts: { listForCustomer: vi.fn().mockResolvedValue([]) },
      wishlist: {
        findByCustomer: vi.fn().mockResolvedValue(null),
        findItems: vi.fn().mockResolvedValue([]),
      },
      orders: { findByCustomer: vi.fn().mockResolvedValue([]) },
      wardrobe: { findByCustomer: vi.fn().mockResolvedValue([]) },
      wardrobeRoadmaps: {
        findByCustomer: vi.fn().mockResolvedValue([]),
      },
      products: { findByRetailer: vi.fn().mockResolvedValue([]) },
      variants: {
        findByProduct: vi.fn().mockResolvedValue([]),
        findById: vi.fn(),
      },
    } as never);

    const projection = await repo.projectForCustomer({
      retailerId,
      customerId,
      viewerCustomerId: customerId,
      now,
    });

    expect(projection.visibility).toBe("consent_withdrawn");
    expect(projection.recommendations).toEqual([]);
  });
});
