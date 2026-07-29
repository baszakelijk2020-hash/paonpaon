import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { TableServiceGuidanceRepository } from "./table-service-guidance-repository";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const productId = asId<"ProductId">("55555555-5555-4555-8555-555555555555");
const variantId = asId<"ProductVariantId">(
  "66666666-6666-4666-8666-666666666666",
);
const knowledgeId = asId<"KnowledgeObjectId">(
  "77777777-7777-4777-8777-777777777777",
);
const conceptId = asId<"MetadataConceptId">(
  "44444444-4444-4444-8444-444444444444",
);
const forgedProductId = asId<"ProductId">(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
);

describe("TableServiceGuidanceRepository", () => {
  function buildDeps() {
    return {
      retailers: {
        findById: vi.fn().mockResolvedValue({
          id: retailerId,
          status: "active",
          displayName: "Maison Demo",
        }),
      },
      catalogue: {
        search: vi.fn().mockResolvedValue({
          hits: [
            {
              productId,
              score: 2,
              explanation: {
                matchedConceptIds: [conceptId],
                factors: [
                  {
                    code: "intent_match",
                    delta: 1,
                    detail: "Matched summer wedding intent",
                  },
                ],
              },
            },
          ],
          total: 1,
          page: 1,
          pageSize: 6,
          unresolvedQueryTokens: [],
        }),
      },
      metadata: {
        findVisibleConcepts: vi.fn().mockResolvedValue([
          {
            id: conceptId,
            retailerId: null,
            kind: "occasion",
            slug: "wedding",
            canonicalName: "Wedding",
            description: null,
            active: true,
            createdAt: "2026-07-30T00:00:00.000Z",
            updatedAt: "2026-07-30T00:00:00.000Z",
            deletedAt: null,
          },
        ]),
      },
      knowledge: {
        projectDiscoveryCandidates: vi.fn().mockResolvedValue([
          {
            object: {
              id: knowledgeId,
              retailerId: null,
              topic: "occasion",
              slug: "wedding-occasion",
              title: "Wedding occasion dressing",
              summary: "Choose lighter weaves for warm weddings.",
              displayTypes: ["information_card"],
              commercialIntent: "educate",
              priority: 10,
              active: true,
              createdAt: "2026-07-30T00:00:00.000Z",
              updatedAt: "2026-07-30T00:00:00.000Z",
              deletedAt: null,
            },
            matchedConcepts: [{ conceptId, matchStrength: 1 }],
            override: null,
          },
        ]),
      },
      products: {
        findById: vi.fn().mockResolvedValue({
          id: productId,
          retailerId,
          name: "Linen summer jacket",
          slug: "linen-summer-jacket",
          status: "active",
        }),
      },
      variants: {
        findByProduct: vi.fn().mockResolvedValue([{ id: variantId }]),
      },
    };
  }

  it("builds deterministic summer-wedding guidance with handoff paths", async () => {
    const repo = new TableServiceGuidanceRepository(
      {} as PaonSupabaseClient,
      buildDeps() as never,
    );

    const result = await repo.projectGuidance({
      retailerId,
      slug: "maison-demo",
      intent: "wedding",
      caption: "I'm a wedding guest",
      freeText: "summer-chic wedding in May 2027",
    });

    expect(result.plan.handoffVisible).toBe(true);
    expect(result.plan.answer.status).toBe("answered");
    expect(result.plan.shortlist).toHaveLength(1);
    expect(result.plan.knowledgeCards.length).toBeGreaterThan(0);
    expect(result.plan.swipePath).toContain("/r/maison-demo/swipe?");
    expect(result.plan.appointmentPath).toContain(
      "/r/maison-demo/appointments?",
    );
    expect(
      result.chatLines.some((line) => line.includes("Message advisor")),
    ).toBe(true);
  });

  it("refuses AI answers that cite products outside the shortlist", async () => {
    const repo = new TableServiceGuidanceRepository(
      {} as PaonSupabaseClient,
      buildDeps() as never,
    );

    const result = await repo.projectGuidance({
      retailerId,
      slug: "maison-demo",
      intent: "wedding",
      aiAnswer: {
        status: "answered",
        answerText: "Invented claim",
        citations: [
          {
            kind: "product",
            id: forgedProductId,
            title: "Not in shortlist",
          },
        ],
        handoffRecommended: false,
      },
    });

    expect(result.plan.answer.status).toBe("refused");
    expect(result.plan.answer.refusalReason).toBe("citation_outside_allowlist");
    expect(result.plan.handoffVisible).toBe(true);
  });
});
