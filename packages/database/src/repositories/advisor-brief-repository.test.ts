import { asId, type AdvisorPreparationBrief } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { AdvisorBriefRepository } from "./advisor-brief-repository";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const otherRetailerId = asId<"RetailerId">(
  "22222222-2222-4222-8222-222222222222",
);
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const conceptId = asId<"MetadataConceptId">(
  "44444444-4444-4444-8444-444444444444",
);
const productId = asId<"ProductId">("55555555-5555-4555-8555-555555555555");
const variantId = asId<"ProductVariantId">(
  "66666666-6666-4666-8666-666666666666",
);
const knowledgeId = asId<"KnowledgeObjectId">(
  "77777777-7777-4777-8777-777777777777",
);
const conversationId = asId<"ConversationId">(
  "88888888-8888-4888-8888-888888888888",
);
const wishlistId = asId<"WishlistId">("99999999-9999-4999-8999-999999999999");
const now = "2026-07-30T10:00:00.000Z";

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

function withdrawnConsent() {
  return {
    ...grantedConsent(),
    personalization: {
      purpose: "personalization" as const,
      status: "withdrawn" as const,
      withdrawnAt: "2026-07-01T00:00:00.000Z",
    },
  };
}

describe("AdvisorBriefRepository", () => {
  it("assembles a complete consented brief from repository sources", async () => {
    const deps = {
      consent: {
        getState: vi.fn().mockResolvedValue(grantedConsent()),
      },
      analytics: {
        findRecentByCustomer: vi.fn().mockResolvedValue([
          {
            id: asId<"BehavioralEventId">(
              "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            ),
            retailerId,
            customerId,
            name: "knowledge_opened",
            properties: { knowledgeObjectId: knowledgeId },
            occurredAt: "2026-07-28T11:00:00.000Z",
            source: "customer_portal",
            purpose: "personalization",
            consentBasis: "explicit_opt_in",
            consentSnapshot: {
              personalization: "granted",
              marketing: "denied",
              location: "denied",
              capturedAt: "2026-07-28T11:00:00.000Z",
              basis: "explicit_opt_in",
            },
            retentionClass: "personalization_signal",
            retentionExpiresAt: "2027-07-28T11:00:00.000Z",
          },
        ]),
      },
      styleProfile: {
        findByCustomer: vi.fn().mockResolvedValue({
          id: asId<"CustomerStyleProfileId">(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          ),
          retailerId,
          customerId,
          explicitPreferences: [
            {
              conceptId,
              polarity: "positive",
              note: "Summer wedding",
              updatedAt: "2026-07-15T00:00:00.000Z",
            },
          ],
          inferredPreferences: [],
          confidence: {
            overall: 0.8,
            inferredCount: 0,
            explicitCount: 1,
            activeEvidenceCount: 1,
          },
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-15T00:00:00.000Z",
        }),
        listEvidence: vi.fn().mockResolvedValue([
          {
            id: asId<"StylePreferenceEvidenceId">(
              "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            ),
            retailerId,
            customerId,
            conceptId,
            source: "product_favorited",
            polarity: "positive",
            confidence: 1,
            createdAt: "2026-07-20T00:00:00.000Z",
          },
        ]),
      },
      wishlist: {
        findByCustomer: vi.fn().mockResolvedValue({
          id: wishlistId,
          customerId,
          name: "Saved",
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        }),
        findItems: vi.fn().mockResolvedValue([
          {
            wishlistId,
            productVariantId: variantId,
            addedAt: "2026-07-27T00:00:00.000Z",
          },
        ]),
      },
      messaging: {
        findByCustomer: vi.fn().mockResolvedValue({
          id: conversationId,
          retailerId,
          customerId,
          intent: "wedding",
          createdAt: now,
          updatedAt: now,
        }),
        findMessages: vi.fn().mockResolvedValue([
          {
            id: asId<"MessageId">("dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
            conversationId,
            senderType: "customer",
            body: "Do you have linen for May?",
            createdAt: "2026-07-28T09:00:00.000Z",
            updatedAt: "2026-07-28T09:00:00.000Z",
          },
        ]),
      },
      products: {
        findById: vi.fn().mockResolvedValue({
          id: productId,
          retailerId,
          name: "Navy fresco jacket",
          slug: "navy-fresco-jacket",
          description: "",
          status: "active",
          isMadeToOrder: false,
          isAlterable: true,
          collectionIds: [],
          createdAt: now,
          updatedAt: now,
        }),
      },
      variants: {
        findById: vi.fn().mockResolvedValue({
          id: variantId,
          productId,
          sku: "NFJ-50",
          size: "50",
          price: { amountMinorUnits: 10000, currency: "EUR" },
          inventoryQuantity: 1,
          createdAt: now,
          updatedAt: now,
        }),
      },
      metadata: {
        findConceptById: vi.fn().mockResolvedValue({
          id: conceptId,
          retailerId: null,
          kind: "occasion",
          slug: "summer-wedding",
          canonicalName: "Summer wedding",
          attributes: {},
          active: true,
          createdAt: now,
          updatedAt: now,
        }),
      },
      knowledge: {
        findById: vi.fn().mockResolvedValue({
          id: knowledgeId,
          retailerId: null,
          topic: "fibre",
          title: "Fresco cloth explained",
          slug: "fresco",
          summary: "Breathable wool",
          displayTypes: ["card"],
          commercialIntent: "educate",
          priority: 1,
          active: true,
          createdAt: now,
          updatedAt: now,
        }),
      },
      wardrobeRoadmaps: {
        findActiveApprovedGapsForBrief: vi.fn().mockResolvedValue([
          {
            gapId: asId<"WardrobeRoadmapGapId">(
              "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            ),
            title: "Missing navy jacket",
            rank: 1,
            howPurchaseFillsGap: "Anchors weekday looks.",
            slotKind: "jacket" as const,
          },
        ]),
      },
      wardrobeSelfScan: {
        findRecentByCustomer: vi.fn().mockResolvedValue([]),
      },
      wardrobe: {
        findByCustomer: vi.fn().mockResolvedValue([]),
      },
    };

    const repo = new AdvisorBriefRepository(
      {} as PaonSupabaseClient,
      deps as never,
    );
    const brief: AdvisorPreparationBrief = await repo.projectForCustomer({
      retailerId,
      customerId,
      advisorRetailerId: retailerId,
      appointmentNotes: "Garden wedding in May",
      now,
    });

    expect(brief.visibility).toBe("usable");
    expect(brief.savedProducts[0]?.label).toContain("Navy fresco jacket");
    expect(brief.knowledgeConsumed[0]?.label).toBe("Fresco cloth explained");
    expect(brief.questions[0]?.body).toContain("linen");
    expect(brief.conversation?.intent).toBe("wedding");
    expect(brief.evidence[0]?.conceptLabel).toBe("Summer wedding");
    expect(brief.wardrobeGaps[0]?.title).toBe("Missing navy jacket");
    expect(JSON.stringify(brief)).not.toMatch(/password|ssn/i);
  });

  it("returns empty intelligence when consent is withdrawn", async () => {
    const repo = new AdvisorBriefRepository(
      {} as PaonSupabaseClient,
      {
        consent: {
          getState: vi.fn().mockResolvedValue(withdrawnConsent()),
        },
        analytics: { findRecentByCustomer: vi.fn().mockResolvedValue([]) },
        styleProfile: {
          findByCustomer: vi.fn().mockResolvedValue(null),
          listEvidence: vi.fn().mockResolvedValue([]),
        },
        wishlist: {
          findByCustomer: vi.fn().mockResolvedValue(null),
          findItems: vi.fn(),
        },
        messaging: {
          findByCustomer: vi.fn().mockResolvedValue(null),
          findMessages: vi.fn(),
        },
        products: { findById: vi.fn() },
        variants: { findById: vi.fn() },
        metadata: { findConceptById: vi.fn() },
        knowledge: { findById: vi.fn() },
        wardrobeRoadmaps: {
          findActiveApprovedGapsForBrief: vi.fn().mockResolvedValue([]),
        },
        wardrobeSelfScan: {
          findRecentByCustomer: vi.fn().mockResolvedValue([]),
        },
        wardrobe: {
          findByCustomer: vi.fn().mockResolvedValue([]),
        },
      } as never,
    );

    const brief = await repo.projectForCustomer({
      retailerId,
      customerId,
      advisorRetailerId: retailerId,
      now,
    });

    expect(brief.visibility).toBe("consent_withdrawn");
    expect(brief.interests).toEqual([]);
    expect(brief.evidence).toEqual([]);
    expect(brief.shortlist).toEqual([]);
  });

  it("denies cross-tenant advisor projection", async () => {
    const repo = new AdvisorBriefRepository(
      {} as PaonSupabaseClient,
      {
        consent: {
          getState: vi.fn().mockResolvedValue(grantedConsent()),
        },
        analytics: { findRecentByCustomer: vi.fn().mockResolvedValue([]) },
        styleProfile: {
          findByCustomer: vi.fn().mockResolvedValue(null),
          listEvidence: vi.fn().mockResolvedValue([]),
        },
        wishlist: {
          findByCustomer: vi.fn().mockResolvedValue(null),
          findItems: vi.fn(),
        },
        messaging: {
          findByCustomer: vi.fn().mockResolvedValue(null),
          findMessages: vi.fn(),
        },
        products: { findById: vi.fn() },
        variants: { findById: vi.fn() },
        metadata: { findConceptById: vi.fn() },
        knowledge: { findById: vi.fn() },
        wardrobeRoadmaps: {
          findActiveApprovedGapsForBrief: vi.fn().mockResolvedValue([]),
        },
        wardrobeSelfScan: {
          findRecentByCustomer: vi.fn().mockResolvedValue([]),
        },
        wardrobe: {
          findByCustomer: vi.fn().mockResolvedValue([]),
        },
      } as never,
    );

    const brief = await repo.projectForCustomer({
      retailerId,
      customerId,
      advisorRetailerId: otherRetailerId,
      now,
    });

    expect(brief.visibility).toBe("consent_denied");
    expect(brief.interests).toEqual([]);
  });
});
