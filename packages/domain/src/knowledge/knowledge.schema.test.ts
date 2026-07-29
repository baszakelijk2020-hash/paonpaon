import { describe, expect, it } from "vitest";

import {
  createKnowledgeObjectConceptInputSchema,
  createKnowledgeObjectInputSchema,
  createKnowledgeObjectRelationInputSchema,
  createRetailerKnowledgeOverrideInputSchema,
  KNOWLEDGE_COMMERCIAL_INTENTS,
  KNOWLEDGE_DISPLAY_TYPES,
  KNOWLEDGE_EDUCATION_TOPICS,
  KNOWLEDGE_RELATION_KINDS,
} from "./knowledge.schema";

const knowledgeObjectId = "00000000-0000-4000-8000-000000000010";
const conceptId = "00000000-0000-4000-8000-000000000011";

describe("knowledge enum schemas", () => {
  it("accepts every founder-named education topic bucket", () => {
    for (const topic of KNOWLEDGE_EDUCATION_TOPICS) {
      expect(
        createKnowledgeObjectInputSchema.safeParse({
          title: "Fixture",
          slug: topic,
          summary: "Neutral fixture summary for automated tests.",
          displayTypes: ["information_card"],
          commercialIntent: "educate",
          educationTopic: topic,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects unknown display, intent, relation, and topic values", () => {
    expect(
      createKnowledgeObjectInputSchema.safeParse({
        title: "Fixture",
        slug: "fixture",
        summary: "Summary",
        displayTypes: ["poster"],
        commercialIntent: "educate",
        educationTopic: "mills",
      }).success,
    ).toBe(false);
    expect(KNOWLEDGE_DISPLAY_TYPES).toHaveLength(5);
    expect(KNOWLEDGE_COMMERCIAL_INTENTS).toHaveLength(5);
    expect(KNOWLEDGE_RELATION_KINDS).toHaveLength(4);
    expect(KNOWLEDGE_EDUCATION_TOPICS).toHaveLength(12);
  });
});

describe("createKnowledgeObjectInputSchema", () => {
  it("requires at least one display type and a valid slug", () => {
    expect(
      createKnowledgeObjectInputSchema.safeParse({
        title: "Mill heritage",
        slug: "Mill Heritage",
        summary: "Why mill provenance matters for value and fit.",
        displayTypes: [],
        commercialIntent: "justify_premium",
        educationTopic: "mills",
      }).success,
    ).toBe(false);

    const parsed = createKnowledgeObjectInputSchema.parse({
      title: "Mill heritage",
      slug: "mill-heritage",
      summary: "Why mill provenance matters for value and fit.",
      displayTypes: ["information_card", "accordion"],
      commercialIntent: "justify_premium",
      educationTopic: "mills",
      priority: 5,
    });

    expect(parsed.retailerId).toBeNull();
    expect(parsed.active).toBe(true);
  });
});

describe("createKnowledgeObjectConceptInputSchema", () => {
  it("bounds match strength to four decimal places", () => {
    expect(
      createKnowledgeObjectConceptInputSchema.safeParse({
        knowledgeObjectId,
        conceptId,
        matchStrength: 1.00001,
      }).success,
    ).toBe(false);

    expect(
      createKnowledgeObjectConceptInputSchema.parse({
        knowledgeObjectId,
        conceptId,
        matchStrength: 0.875,
      }).matchStrength,
    ).toBe(0.875);
  });
});

describe("createKnowledgeObjectRelationInputSchema", () => {
  it("rejects self-relations", () => {
    expect(
      createKnowledgeObjectRelationInputSchema.safeParse({
        sourceKnowledgeObjectId: knowledgeObjectId,
        targetKnowledgeObjectId: knowledgeObjectId,
        kind: "related",
      }).success,
    ).toBe(false);
  });
});

describe("createRetailerKnowledgeOverrideInputSchema", () => {
  it("defaults hide and pin to false", () => {
    const parsed = createRetailerKnowledgeOverrideInputSchema.parse({
      retailerId: "00000000-0000-4000-8000-000000000001",
      knowledgeObjectId,
      titleOverride: "Local title",
    });

    expect(parsed.isHidden).toBe(false);
    expect(parsed.isPinned).toBe(false);
  });
});
