import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  buildDeterministicGroundedAnswer,
  buildOccasionWelcomeLines,
  validateTableServiceGroundedAnswer,
  type TableServiceOccasionBundle,
} from "./table-service-grounding";

const knowledgeId = asId<"KnowledgeObjectId">(
  "a1000000-0000-4000-8000-000000000001",
);
const productId = asId<"ProductId">("b2000000-0000-4000-8000-000000000002");
const retailerId = asId<"RetailerId">("c3000000-0000-4000-8000-000000000003");

function sampleBundle(
  overrides: Partial<TableServiceOccasionBundle> = {},
): TableServiceOccasionBundle {
  return {
    retailerId,
    occasionPhrase: "summer wedding",
    intentExplanation:
      "Maps to warm-climate season and wedding occasion concepts",
    resolvedConceptIds: [],
    knowledge: [
      {
        knowledgeObjectId: knowledgeId,
        title: "Summer wedding fabrics",
        summary: "Lightweight breathable cloth stays comfortable outdoors.",
        score: 12,
      },
    ],
    shortlist: [
      {
        productId,
        name: "Linen summer jacket",
        score: 8,
        explanation: "Matched wedding occasion; weight under 280gsm",
      },
    ],
    allowedKnowledgeIds: [knowledgeId],
    allowedProductIds: [productId],
    ...overrides,
  };
}

describe("validateTableServiceGroundedAnswer", () => {
  it("accepts citations within the allowlist", () => {
    const result = validateTableServiceGroundedAnswer(
      {
        body: "Lightweight linen works well.",
        citations: [knowledgeId],
        citedProductIds: [productId],
        uncertainty: "low",
        refused: false,
        handoffRecommended: true,
      },
      {
        knowledgeIds: new Set([knowledgeId]),
        productIds: new Set([productId]),
      },
    );
    expect(result.ok).toBe(true);
    expect(result.answer?.citations).toEqual([knowledgeId]);
  });

  it("rejects citations outside the allowlist", () => {
    const foreignId = asId<"KnowledgeObjectId">(
      "d4000000-0000-4000-8000-000000000004",
    );
    const result = validateTableServiceGroundedAnswer(
      {
        body: "Invented fact.",
        citations: [foreignId],
        uncertainty: "low",
      },
      {
        knowledgeIds: new Set([knowledgeId]),
        productIds: new Set([productId]),
      },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("allowlist");
  });

  it("requires citations when not refusing", () => {
    const result = validateTableServiceGroundedAnswer(
      { body: "No basis.", refused: false },
      {
        knowledgeIds: new Set([knowledgeId]),
        productIds: new Set([productId]),
      },
    );
    expect(result.ok).toBe(false);
  });
});

describe("buildDeterministicGroundedAnswer", () => {
  it("refuses when no approved bundle content exists", () => {
    const answer = buildDeterministicGroundedAnswer({
      bundle: sampleBundle({ knowledge: [], shortlist: [] }),
    });
    expect(answer.refused).toBe(true);
    expect(answer.handoffRecommended).toBe(true);
  });

  it("summarizes knowledge and shortlist with citations", () => {
    const answer = buildDeterministicGroundedAnswer({
      bundle: sampleBundle(),
    });
    expect(answer.refused).toBe(false);
    expect(answer.citations).toContain(knowledgeId);
    expect(answer.citedProductIds).toContain(productId);
    expect(answer.body).toContain("Summer wedding fabrics");
    expect(answer.handoffRecommended).toBe(true);
  });
});

describe("buildOccasionWelcomeLines", () => {
  it("includes shortlist and swipe guidance", () => {
    const lines = buildOccasionWelcomeLines(sampleBundle());
    expect(lines.join(" ")).toContain("summer wedding");
    expect(lines.join(" ")).toContain("Swipe");
  });
});
