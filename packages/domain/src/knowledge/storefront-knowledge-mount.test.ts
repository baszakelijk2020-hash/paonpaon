import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import type { KnowledgeDiscoveryResult } from "./knowledge-discovery";
import {
  STOREFRONT_KNOWLEDGE_CARD_CLASS_NAMES,
  STOREFRONT_KNOWLEDGE_FALLBACK_IMAGE,
  emptyStorefrontKnowledgeBySection,
  partitionDiscoveryForStorefront,
  storefrontSectionForTopic,
  toStorefrontKnowledgeCard,
} from "./storefront-knowledge-mount";

function discoveryResult(
  partial: Pick<KnowledgeDiscoveryResult, "knowledgeObjectId" | "topic"> &
    Partial<KnowledgeDiscoveryResult>,
): KnowledgeDiscoveryResult {
  return {
    presentation: {
      title: "Example title",
      summary: "Example summary",
      priority: 0,
      isPinned: false,
      isHidden: false,
    },
    score: 1,
    factors: [],
    matchedConceptIds: [],
    ...partial,
  };
}

describe("storefrontSectionForTopic", () => {
  it("maps fabric topics to the Fabric panel", () => {
    expect(storefrontSectionForTopic("mill")).toBe("fabric");
    expect(storefrontSectionForTopic("weave")).toBe("fabric");
  });

  it("maps style topics to the Archetype panel", () => {
    expect(storefrontSectionForTopic("styling")).toBe("archetype");
    expect(storefrontSectionForTopic("occasion")).toBe("archetype");
  });

  it("maps fit topics to the Sizing panel", () => {
    expect(storefrontSectionForTopic("construction")).toBe("sizing");
    expect(storefrontSectionForTopic("care")).toBe("sizing");
  });
});

describe("toStorefrontKnowledgeCard", () => {
  it("uses the presentation image when present", () => {
    const card = toStorefrontKnowledgeCard(
      discoveryResult({
        knowledgeObjectId: asId("00000000-0000-4000-8000-000000000001"),
        topic: "fabric",
        presentation: {
          title: "Reading a fabric profile",
          summary: "Weight and hand explain seasonality.",
          imageUrl: "https://example.test/swatch.webp",
          priority: 10,
          isPinned: false,
          isHidden: false,
        },
      }),
    );

    expect(card.imageUrl).toBe("https://example.test/swatch.webp");
    expect(card.title).toBe("Reading a fabric profile");
  });

  it("falls back to the neutral square image when no image is provided", () => {
    const card = toStorefrontKnowledgeCard(
      discoveryResult({
        knowledgeObjectId: asId("00000000-0000-4000-8000-000000000002"),
        topic: "fibre",
      }),
    );

    expect(card.imageUrl).toContain("6088.webp");
  });
});

describe("partitionDiscoveryForStorefront", () => {
  it("partitions ranked cards into founder sections with per-section caps", () => {
    const partitioned = partitionDiscoveryForStorefront([
      discoveryResult({
        knowledgeObjectId: asId("00000000-0000-4000-8000-000000000001"),
        topic: "mill",
        presentation: {
          title: "Mill",
          summary: "Mill summary",
          priority: 100,
          isPinned: false,
          isHidden: false,
        },
      }),
      discoveryResult({
        knowledgeObjectId: asId("00000000-0000-4000-8000-000000000002"),
        topic: "fibre",
        presentation: {
          title: "Fibre",
          summary: "Fibre summary",
          priority: 90,
          isPinned: false,
          isHidden: false,
        },
      }),
      discoveryResult({
        knowledgeObjectId: asId("00000000-0000-4000-8000-000000000003"),
        topic: "styling",
        presentation: {
          title: "Styling",
          summary: "Styling summary",
          priority: 80,
          isPinned: false,
          isHidden: false,
        },
      }),
      discoveryResult({
        knowledgeObjectId: asId("00000000-0000-4000-8000-000000000004"),
        topic: "construction",
        presentation: {
          title: "Construction",
          summary: "Construction summary",
          priority: 70,
          isPinned: false,
          isHidden: false,
        },
      }),
      discoveryResult({
        knowledgeObjectId: asId("00000000-0000-4000-8000-000000000005"),
        topic: "weave",
        presentation: {
          title: "Weave overflow",
          summary: "Should be skipped once fabric is full",
          priority: 60,
          isPinned: false,
          isHidden: false,
        },
      }),
    ]);

    expect(partitioned.fabric.map((card) => card.title)).toEqual([
      "Mill",
      "Fibre",
    ]);
    expect(partitioned.archetype.map((card) => card.title)).toEqual([
      "Styling",
    ]);
    expect(partitioned.sizing.map((card) => card.title)).toEqual([
      "Construction",
    ]);
  });

  it("returns empty sections when no discovery results exist", () => {
    expect(partitionDiscoveryForStorefront([])).toEqual(
      emptyStorefrontKnowledgeBySection(),
    );
  });

  it("documents the allowlisted founder DOM hooks for knowledge cards", () => {
    expect(STOREFRONT_KNOWLEDGE_CARD_CLASS_NAMES).toEqual([
      "paon-knowledge-cards",
      "paon-knowledge-card",
      "paon-knowledge-card-img",
      "paon-knowledge-card-copy",
      "paon-knowledge-card-title",
      "paon-knowledge-card-summary",
    ]);
    expect(STOREFRONT_KNOWLEDGE_FALLBACK_IMAGE).toContain(".webp");
  });
});
