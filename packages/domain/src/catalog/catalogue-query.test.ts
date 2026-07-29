import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  paginateCatalogueHits,
  scoreCatalogueCandidate,
  sortCatalogueHits,
  type CatalogueQueryCandidate,
  type CatalogueSearchHit,
} from "./catalogue-query";

const retailerId = asId<"RetailerId">("00000000-0000-4000-8000-0000000000a1");
const productA = asId<"ProductId">("00000000-0000-4000-8000-0000000000p1");
const productB = asId<"ProductId">("00000000-0000-4000-8000-0000000000p2");
const productC = asId<"ProductId">("00000000-0000-4000-8000-0000000000p3");
const millId = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000c1",
);
const weaveId = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000c2",
);
const pendingOnly = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000c9",
);

function candidate(
  partial: Pick<CatalogueQueryCandidate, "productId" | "slug"> &
    Partial<CatalogueQueryCandidate>,
): CatalogueQueryCandidate {
  return {
    name: partial.slug,
    createdAt: "2026-07-30T00:00:00.000Z",
    status: "active",
    acceptedConceptIds: [],
    minPriceMinor: 90000,
    maxPriceMinor: 90000,
    fabricWeightGramsPerSquareMetre: 260,
    ...partial,
  };
}

describe("scoreCatalogueCandidate", () => {
  it("requires every requested accepted concept and excludes missing ones", () => {
    const hit = scoreCatalogueCandidate(
      candidate({
        productId: productA,
        slug: "a",
        acceptedConceptIds: [millId],
      }),
      { conceptIds: [millId, weaveId] },
    );
    expect(hit).toBeNull();
  });

  it("scores accepted concept matches and excludes pending-only filters", () => {
    const hit = scoreCatalogueCandidate(
      candidate({
        productId: productA,
        slug: "a",
        acceptedConceptIds: [millId, weaveId],
      }),
      { conceptIds: [millId] },
    );
    expect(hit).toEqual(
      expect.objectContaining({
        productId: productA,
        score: 1,
        explanation: expect.objectContaining({
          matchedConceptIds: [millId],
        }),
      }),
    );

    // Caller must never pass pending/rejected IDs; a product that only has
    // other accepted concepts does not match an unknown filter id.
    expect(
      scoreCatalogueCandidate(
        candidate({
          productId: productB,
          slug: "b",
          acceptedConceptIds: [millId],
        }),
        { conceptIds: [pendingOnly] },
      ),
    ).toBeNull();
  });

  it("applies weight and price ranges", () => {
    const inRange = scoreCatalogueCandidate(
      candidate({
        productId: productA,
        slug: "a",
        fabricWeightGramsPerSquareMetre: 240,
        minPriceMinor: 85000,
      }),
      {
        ranges: {
          minWeight: 200,
          maxWeight: 280,
          minPriceMinor: 80000,
          maxPriceMinor: 120000,
        },
      },
    );
    expect(inRange?.score).toBe(2);

    expect(
      scoreCatalogueCandidate(
        candidate({
          productId: productB,
          slug: "b",
          fabricWeightGramsPerSquareMetre: 400,
        }),
        { ranges: { maxWeight: 280 } },
      ),
    ).toBeNull();

    expect(
      scoreCatalogueCandidate(
        candidate({
          productId: productC,
          slug: "c",
          fabricWeightGramsPerSquareMetre: null,
        }),
        { ranges: { maxWeight: 280 } },
      ),
    ).toBeNull();
  });

  it("requires intent concepts when no explicit concept filter is set", () => {
    expect(
      scoreCatalogueCandidate(
        candidate({
          productId: productA,
          slug: "a",
          acceptedConceptIds: [millId],
        }),
        {},
        [weaveId],
      ),
    ).toBeNull();

    const hit = scoreCatalogueCandidate(
      candidate({
        productId: productB,
        slug: "b",
        acceptedConceptIds: [weaveId],
      }),
      {},
      [weaveId],
    );
    expect(hit?.score).toBe(1);
  });

  it("excludes non-active candidates", () => {
    expect(
      scoreCatalogueCandidate(
        candidate({
          productId: productA,
          slug: "a",
          status: "draft",
          acceptedConceptIds: [millId],
        }),
        { conceptIds: [millId] },
      ),
    ).toBeNull();
  });
});

describe("sortCatalogueHits and paginateCatalogueHits", () => {
  const candidates = new Map<
    ReturnType<typeof asId<"ProductId">>,
    CatalogueQueryCandidate
  >([
    [
      productA,
      candidate({
        productId: productA,
        slug: "a",
        minPriceMinor: 50000,
        createdAt: "2026-07-01T00:00:00.000Z",
      }),
    ],
    [
      productB,
      candidate({
        productId: productB,
        slug: "b",
        minPriceMinor: 150000,
        createdAt: "2026-07-20T00:00:00.000Z",
      }),
    ],
    [
      productC,
      candidate({
        productId: productC,
        slug: "c",
        minPriceMinor: 90000,
        createdAt: "2026-07-10T00:00:00.000Z",
      }),
    ],
  ]);

  const hits: CatalogueSearchHit[] = [
    {
      productId: productA,
      score: 1,
      explanation: { matchedConceptIds: [], factors: [] },
    },
    {
      productId: productB,
      score: 3,
      explanation: { matchedConceptIds: [], factors: [] },
    },
    {
      productId: productC,
      score: 2,
      explanation: { matchedConceptIds: [], factors: [] },
    },
  ];

  it("sorts by relevance, price, and newest", () => {
    expect(
      sortCatalogueHits(hits, candidates, "relevance").map((h) => h.productId),
    ).toEqual([productB, productC, productA]);
    expect(
      sortCatalogueHits(hits, candidates, "price_asc").map((h) => h.productId),
    ).toEqual([productA, productC, productB]);
    expect(
      sortCatalogueHits(hits, candidates, "newest").map((h) => h.productId),
    ).toEqual([productB, productC, productA]);
  });

  it("paginates deterministically", () => {
    const sorted = sortCatalogueHits(hits, candidates, "relevance");
    const page = paginateCatalogueHits(sorted, 2, 1);
    expect(page).toEqual({
      hits: [sorted[1]],
      total: 3,
      page: 2,
      pageSize: 1,
      unresolvedQueryTokens: [],
    });
    void retailerId;
  });
});
