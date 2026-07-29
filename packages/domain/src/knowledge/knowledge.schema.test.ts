import { describe, expect, it } from "vitest";

import {
  createKnowledgeObjectConceptInputSchema,
  createKnowledgeObjectInputSchema,
  createKnowledgeObjectRelationInputSchema,
  createRetailerKnowledgeOverrideInputSchema,
  KNOWLEDGE_COMMERCIAL_INTENTS,
  KNOWLEDGE_DISPLAY_TYPES,
  KNOWLEDGE_TOPICS,
  updateKnowledgeObjectInputSchema,
} from "./knowledge.schema";

const knowledgeObjectId = "00000000-0000-4000-8000-000000000001";
const conceptId = "00000000-0000-4000-8000-000000000002";
const retailerId = "00000000-0000-4000-8000-000000000003";
const otherObjectId = "00000000-0000-4000-8000-000000000004";

describe("knowledge schema contracts", () => {
  it("covers every founder-named education topic and display contract", () => {
    expect(KNOWLEDGE_TOPICS).toEqual([
      "mill",
      "fibre",
      "fabric",
      "weave",
      "construction",
      "collar",
      "styling",
      "care",
      "performance",
      "occasion",
      "value",
      "tradeoff",
    ]);
    expect(KNOWLEDGE_DISPLAY_TYPES).toEqual([
      "information_card",
      "accordion",
      "tooltip",
      "comparison",
      "advisor_answer",
    ]);
    expect(KNOWLEDGE_COMMERCIAL_INTENTS).toEqual([
      "educate",
      "justify_premium",
      "upgrade",
      "cross_sell",
      "appointment",
    ]);
  });

  it("normalizes a canonical knowledge object", () => {
    expect(
      createKnowledgeObjectInputSchema.parse({
        topic: "fibre",
        title: " Why fibre matters ",
        slug: "  Why-Fibre-Matters  ",
        summary: " Fibre choice shapes comfort. ",
        displayTypes: ["information_card"],
        commercialIntent: "educate",
      }),
    ).toEqual({
      retailerId: null,
      topic: "fibre",
      title: "Why fibre matters",
      slug: "why-fibre-matters",
      summary: "Fibre choice shapes comfort.",
      displayTypes: ["information_card"],
      commercialIntent: "educate",
      priority: 0,
      active: true,
    });
  });

  it("rejects empty display types, duplicates, and bad match strength", () => {
    expect(
      createKnowledgeObjectInputSchema.safeParse({
        topic: "mill",
        title: "Mill",
        slug: "mill",
        summary: "Summary",
        displayTypes: [],
        commercialIntent: "educate",
      }).success,
    ).toBe(false);

    expect(
      createKnowledgeObjectInputSchema.safeParse({
        topic: "mill",
        title: "Mill",
        slug: "mill",
        summary: "Summary",
        displayTypes: ["tooltip", "tooltip"],
        commercialIntent: "educate",
      }).success,
    ).toBe(false);

    expect(
      createKnowledgeObjectConceptInputSchema.safeParse({
        knowledgeObjectId,
        conceptId,
        matchStrength: 1.00001,
      }).success,
    ).toBe(false);

    expect(
      createKnowledgeObjectConceptInputSchema.safeParse({
        knowledgeObjectId,
        conceptId,
        matchStrength: 0.12345,
      }).success,
    ).toBe(false);
  });

  it("rejects self-relations and requires override tenancy fields", () => {
    expect(
      createKnowledgeObjectRelationInputSchema.safeParse({
        sourceKnowledgeObjectId: knowledgeObjectId,
        targetKnowledgeObjectId: knowledgeObjectId,
      }).success,
    ).toBe(false);

    expect(
      createKnowledgeObjectRelationInputSchema.parse({
        sourceKnowledgeObjectId: knowledgeObjectId,
        targetKnowledgeObjectId: otherObjectId,
      }),
    ).toEqual({
      sourceKnowledgeObjectId: knowledgeObjectId,
      targetKnowledgeObjectId: otherObjectId,
    });

    expect(
      createRetailerKnowledgeOverrideInputSchema.parse({
        retailerId,
        knowledgeObjectId,
        isPinned: true,
      }),
    ).toEqual({
      retailerId,
      knowledgeObjectId,
      isHidden: false,
      isPinned: true,
    });
  });

  it("requires active state on updates", () => {
    expect(
      updateKnowledgeObjectInputSchema.safeParse({
        knowledgeObjectId,
        title: "Title",
        summary: "Summary",
        displayTypes: ["accordion"],
        commercialIntent: "upgrade",
        priority: 1,
      }).success,
    ).toBe(false);
  });
});
