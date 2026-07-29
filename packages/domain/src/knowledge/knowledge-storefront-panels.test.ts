import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import type { KnowledgeObject, KnowledgeTopic } from "./knowledge";
import type {
  KnowledgeDiscoveryCandidate,
  KnowledgeDiscoveryResult,
} from "./knowledge-discovery";
import {
  buildStorefrontKnowledgeByProduct,
  EMPTY_STOREFRONT_KNOWLEDGE_PANELS,
  knowledgeTopicToStorefrontPanel,
  partitionStorefrontKnowledgePanels,
  rankStorefrontKnowledgePanels,
  storefrontKnowledgePanelsHaveCards,
  toStorefrontKnowledgeCard,
} from "./knowledge-storefront-panels";

function result(
  topic: KnowledgeTopic,
  suffix: string,
  title = `${topic} title`,
): KnowledgeDiscoveryResult {
  return {
    knowledgeObjectId: asId<"KnowledgeObjectId">(
      `00000000-0000-4000-8000-0000000000${suffix}`,
    ),
    topic,
    presentation: {
      title,
      summary: `${topic} summary`,
      priority: 10,
      isPinned: false,
      isHidden: false,
    },
    score: 1,
    factors: [],
    matchedConceptIds: [],
  };
}

function candidate(
  topic: KnowledgeTopic,
  suffix: string,
  conceptSuffix: string,
): KnowledgeDiscoveryCandidate {
  const conceptId = asId<"MetadataConceptId">(
    `00000000-0000-4000-8000-1000000000${conceptSuffix}`,
  );
  const object = {
    id: asId<"KnowledgeObjectId">(
      `00000000-0000-4000-8000-0000000000${suffix}`,
    ),
    retailerId: null,
    topic,
    title: `${topic} title`,
    slug: `${topic}-slug-${suffix}`,
    summary: `${topic} summary`,
    displayTypes: ["information_card"],
    commercialIntent: "educate",
    priority: 50,
    active: true,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
  } satisfies KnowledgeObject;
  return {
    object,
    matchedConcepts: [{ conceptId, matchStrength: 1 }],
    override: null,
  };
}

describe("knowledgeTopicToStorefrontPanel", () => {
  it("maps cloth topics to Fabric", () => {
    expect(knowledgeTopicToStorefrontPanel("mill")).toBe("fabric");
    expect(knowledgeTopicToStorefrontPanel("fibre")).toBe("fabric");
    expect(knowledgeTopicToStorefrontPanel("fabric")).toBe("fabric");
    expect(knowledgeTopicToStorefrontPanel("weave")).toBe("fabric");
    expect(knowledgeTopicToStorefrontPanel("performance")).toBe("fabric");
  });

  it("maps style topics to Archetype", () => {
    expect(knowledgeTopicToStorefrontPanel("styling")).toBe("archetype");
    expect(knowledgeTopicToStorefrontPanel("occasion")).toBe("archetype");
    expect(knowledgeTopicToStorefrontPanel("value")).toBe("archetype");
    expect(knowledgeTopicToStorefrontPanel("tradeoff")).toBe("archetype");
  });

  it("maps construction and care topics to Sizing", () => {
    expect(knowledgeTopicToStorefrontPanel("construction")).toBe("sizing");
    expect(knowledgeTopicToStorefrontPanel("collar")).toBe("sizing");
    expect(knowledgeTopicToStorefrontPanel("care")).toBe("sizing");
  });
});

describe("partitionStorefrontKnowledgePanels", () => {
  it("returns empty panels when discovery yields nothing", () => {
    expect(partitionStorefrontKnowledgePanels([])).toEqual(
      EMPTY_STOREFRONT_KNOWLEDGE_PANELS,
    );
    expect(
      storefrontKnowledgePanelsHaveCards(EMPTY_STOREFRONT_KNOWLEDGE_PANELS),
    ).toBe(false);
  });

  it("serializes square-card fields and partitions by panel", () => {
    const panels = partitionStorefrontKnowledgePanels([
      result("styling", "01"),
      result("mill", "02"),
      result("construction", "03"),
      result("fibre", "04"),
    ]);

    expect(panels.archetype).toHaveLength(1);
    expect(panels.fabric).toHaveLength(2);
    expect(panels.sizing).toHaveLength(1);
    expect(toStorefrontKnowledgeCard(result("mill", "02")).imageUrl).toBeNull();
    expect(panels.fabric[0]).toMatchObject({
      topic: "mill",
      panel: "fabric",
      title: "mill title",
      summary: "mill summary",
      imageUrl: null,
    });
    expect(storefrontKnowledgePanelsHaveCards(panels)).toBe(true);
  });

  it("preserves discovery order within each panel", () => {
    const panels = partitionStorefrontKnowledgePanels([
      result("fibre", "01", "first fibre"),
      result("mill", "02", "second mill"),
      result("weave", "03", "third weave"),
    ]);
    expect(panels.fabric.map((card) => card.title)).toEqual([
      "first fibre",
      "second mill",
      "third weave",
    ]);
  });
});

describe("rankStorefrontKnowledgePanels", () => {
  it("keeps Archetype cards when care would otherwise consume the shared diversity bucket", () => {
    const retailerId = asId<"RetailerId">(
      "00000000-0000-4000-8000-aaaaaaaaaaaa",
    );
    const conceptIds = [
      asId<"MetadataConceptId">("00000000-0000-4000-8000-100000000001"),
      asId<"MetadataConceptId">("00000000-0000-4000-8000-100000000007"),
      asId<"MetadataConceptId">("00000000-0000-4000-8000-100000000008"),
    ];
    const panels = rankStorefrontKnowledgePanels(
      {
        retailerId,
        acceptedProductConceptIds: conceptIds,
        journey: "product_detail",
      },
      [
        candidate("mill", "01", "01"),
        candidate("styling", "07", "07"),
        candidate("care", "08", "08"),
      ],
    );

    expect(panels.fabric.map((card) => card.topic)).toEqual(["mill"]);
    expect(panels.archetype.map((card) => card.topic)).toEqual(["styling"]);
    expect(panels.sizing.map((card) => card.topic)).toEqual(["care"]);
  });
});

describe("buildStorefrontKnowledgeByProduct", () => {
  it("keys panels by product slug for route JSON injection", () => {
    const panels = partitionStorefrontKnowledgePanels([
      result("mill", "01"),
      result("styling", "02"),
    ]);
    const payload = buildStorefrontKnowledgeByProduct(
      new Map([
        ["overcoat", panels],
        ["empty-product", EMPTY_STOREFRONT_KNOWLEDGE_PANELS],
      ]),
    );

    expect(payload["overcoat"]?.fabric).toHaveLength(1);
    expect(payload["overcoat"]?.archetype).toHaveLength(1);
    expect(payload["empty-product"]).toEqual(EMPTY_STOREFRONT_KNOWLEDGE_PANELS);
  });
});
