import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import type { KnowledgeObject, RetailerKnowledgeOverride } from "./knowledge";
import {
  knowledgeDiversityBucket,
  rankKnowledgeDiscovery,
  type KnowledgeDiscoveryCandidate,
  type KnowledgeDiscoveryRequest,
} from "./knowledge-discovery";

const retailerId = asId<"RetailerId">("00000000-0000-4000-8000-0000000000a1");
const conceptMill = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000c1",
);
const conceptFibre = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000c2",
);
const conceptWeave = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000c3",
);
const conceptConstruction = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000c4",
);
const conceptOccasion = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000c5",
);
const pendingConcept = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-0000000000c9",
);

function object(
  partial: Pick<KnowledgeObject, "id" | "topic" | "slug" | "title"> &
    Partial<KnowledgeObject>,
): KnowledgeObject {
  return {
    retailerId: null,
    summary: `${partial.title} summary`,
    displayTypes: ["information_card"],
    commercialIntent: "educate",
    priority: 0,
    active: true,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    deletedAt: null,
    ...partial,
  };
}

function candidate(
  knowledge: KnowledgeObject,
  conceptId: typeof conceptMill,
  override: RetailerKnowledgeOverride | null = null,
  matchStrength = 1,
): KnowledgeDiscoveryCandidate {
  return {
    object: knowledge,
    matchedConcepts: [{ conceptId, matchStrength }],
    override,
  };
}

const mill = object({
  id: asId<"KnowledgeObjectId">("00000000-0000-4000-8000-000000000001"),
  topic: "mill",
  slug: "mill-card",
  title: "Mill card",
  priority: 10,
});
const fibre = object({
  id: asId<"KnowledgeObjectId">("00000000-0000-4000-8000-000000000002"),
  topic: "fibre",
  slug: "fibre-card",
  title: "Fibre card",
  priority: 20,
  commercialIntent: "justify_premium",
});
const weave = object({
  id: asId<"KnowledgeObjectId">("00000000-0000-4000-8000-000000000003"),
  topic: "weave",
  slug: "weave-card",
  title: "Weave card",
  priority: 15,
});
const construction = object({
  id: asId<"KnowledgeObjectId">("00000000-0000-4000-8000-000000000004"),
  topic: "construction",
  slug: "construction-card",
  title: "Construction card",
  priority: 5,
});
const occasion = object({
  id: asId<"KnowledgeObjectId">("00000000-0000-4000-8000-000000000005"),
  topic: "occasion",
  slug: "occasion-card",
  title: "Occasion card",
  priority: 8,
  commercialIntent: "appointment",
});
const fabricDuplicate = object({
  id: asId<"KnowledgeObjectId">("00000000-0000-4000-8000-000000000006"),
  topic: "fabric",
  slug: "fabric-card",
  title: "Fabric card",
  priority: 50,
});
const inactive = object({
  id: asId<"KnowledgeObjectId">("00000000-0000-4000-8000-000000000007"),
  topic: "care",
  slug: "inactive-care",
  title: "Inactive care",
  active: false,
});

const baseRequest: KnowledgeDiscoveryRequest = {
  retailerId,
  acceptedProductConceptIds: [
    conceptMill,
    conceptFibre,
    conceptWeave,
    conceptConstruction,
    conceptOccasion,
  ],
  journey: "product_detail",
};

describe("knowledgeDiversityBucket", () => {
  it("maps founder diversity groups", () => {
    expect(knowledgeDiversityBucket("mill")).toBe("mill");
    expect(knowledgeDiversityBucket("fibre")).toBe("fibre_composition");
    expect(knowledgeDiversityBucket("fabric")).toBe("fibre_composition");
    expect(knowledgeDiversityBucket("weave")).toBe("weave_performance");
    expect(knowledgeDiversityBucket("collar")).toBe("construction_detail");
    expect(knowledgeDiversityBucket("occasion")).toBe("style_occasion");
  });
});

describe("rankKnowledgeDiscovery", () => {
  it("returns three to six explainable cards from accepted overlaps", () => {
    const results = rankKnowledgeDiscovery(baseRequest, [
      candidate(mill, conceptMill),
      candidate(fibre, conceptFibre),
      candidate(weave, conceptWeave),
      candidate(construction, conceptConstruction),
      candidate(occasion, conceptOccasion),
      candidate(fabricDuplicate, conceptFibre),
    ]);

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.length).toBeLessThanOrEqual(6);
    for (const result of results) {
      expect(result.factors.length).toBeGreaterThan(0);
      expect(result.matchedConceptIds.length).toBeGreaterThan(0);
      expect(result.score).toEqual(expect.any(Number));
    }
  });

  it("excludes pending/rejected concepts, inactive, and hidden cards", () => {
    const hiddenOverride: RetailerKnowledgeOverride = {
      id: asId<"RetailerKnowledgeOverrideId">(
        "00000000-0000-4000-8000-0000000000d1",
      ),
      retailerId,
      knowledgeObjectId: mill.id,
      isHidden: true,
      isPinned: true,
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
      deletedAt: null,
    };

    const results = rankKnowledgeDiscovery(
      {
        ...baseRequest,
        acceptedProductConceptIds: [conceptFibre],
      },
      [
        candidate(mill, conceptMill, hiddenOverride),
        candidate(inactive, conceptFibre),
        candidate(fibre, pendingConcept),
        candidate(fibre, conceptFibre),
      ],
    );

    expect(results.map((row) => row.knowledgeObjectId)).toEqual([fibre.id]);
  });

  it("applies pin and priority precedence over equal concept matches", () => {
    const pinned: RetailerKnowledgeOverride = {
      id: asId<"RetailerKnowledgeOverrideId">(
        "00000000-0000-4000-8000-0000000000d2",
      ),
      retailerId,
      knowledgeObjectId: mill.id,
      isHidden: false,
      isPinned: true,
      priorityOverride: 5,
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
      deletedAt: null,
    };

    const results = rankKnowledgeDiscovery(baseRequest, [
      candidate(fibre, conceptFibre),
      candidate(mill, conceptMill, pinned),
      candidate(weave, conceptWeave),
    ]);

    expect(results[0]?.knowledgeObjectId).toBe(mill.id);
    expect(results[0]?.presentation.isPinned).toBe(true);
    expect(
      results[0]?.factors.some((factor) => factor.code === "retailer_pin"),
    ).toBe(true);
  });

  it("penalizes already-viewed cards and prefers novelty", () => {
    const results = rankKnowledgeDiscovery(
      {
        ...baseRequest,
        viewedKnowledgeObjectIds: [fibre.id],
        customerSeenConceptIds: [conceptFibre],
      },
      [
        candidate(fibre, conceptFibre, null, 1),
        candidate(weave, conceptWeave, null, 1),
        candidate(construction, conceptConstruction, null, 1),
      ],
    );

    expect(results.map((row) => row.knowledgeObjectId)).not.toEqual([
      fibre.id,
      weave.id,
      construction.id,
    ]);
    expect(results[0]?.knowledgeObjectId).not.toBe(fibre.id);
    expect(
      results.some((row) =>
        row.factors.some((factor) => factor.code === "already_viewed"),
      ),
    ).toBe(true);
  });

  it("enforces topic diversity instead of five near-duplicate fabric cards", () => {
    const nearDuplicates = [1, 2, 3, 4, 5].map((index) =>
      object({
        id: asId<"KnowledgeObjectId">(
          `00000000-0000-4000-8000-00000000001${index}`,
        ),
        topic: index % 2 === 0 ? "fabric" : "fibre",
        slug: `fabric-ish-${index}`,
        title: `Fabric-ish ${index}`,
        priority: 100 - index,
      }),
    );

    const results = rankKnowledgeDiscovery(baseRequest, [
      ...nearDuplicates.map((row) => candidate(row, conceptFibre)),
      candidate(mill, conceptMill),
      candidate(weave, conceptWeave),
      candidate(construction, conceptConstruction),
      candidate(occasion, conceptOccasion),
    ]);

    const buckets = new Set(
      results.map((row) => knowledgeDiversityBucket(row.topic)),
    );
    expect(buckets.size).toBeGreaterThanOrEqual(3);
    expect(results.length).toBeLessThanOrEqual(6);
  });

  it("returns an empty list when no accepted candidates exist", () => {
    expect(
      rankKnowledgeDiscovery(
        { ...baseRequest, acceptedProductConceptIds: [] },
        [candidate(mill, conceptMill)],
      ),
    ).toEqual([]);
  });

  it("breaks score ties by priority then slug", () => {
    const alpha = object({
      id: asId<"KnowledgeObjectId">("00000000-0000-4000-8000-0000000000a1"),
      topic: "mill",
      slug: "alpha-mill",
      title: "Alpha",
      priority: 10,
    });
    const beta = object({
      id: asId<"KnowledgeObjectId">("00000000-0000-4000-8000-0000000000b1"),
      topic: "weave",
      slug: "beta-weave",
      title: "Beta",
      priority: 10,
    });

    const results = rankKnowledgeDiscovery(
      {
        ...baseRequest,
        journey: "browse",
        acceptedProductConceptIds: [conceptMill, conceptWeave],
      },
      [
        candidate(beta, conceptWeave, null, 1),
        candidate(alpha, conceptMill, null, 1),
      ],
    );

    expect(results.map((row) => row.knowledgeObjectId)).toEqual([
      alpha.id,
      beta.id,
    ]);
  });
});
