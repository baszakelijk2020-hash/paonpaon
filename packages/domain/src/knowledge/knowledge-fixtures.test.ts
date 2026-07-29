import { describe, expect, it } from "vitest";

import { isKnowledgeObjectEligible } from "./knowledge";
import {
  CANONICAL_KNOWLEDGE_FIXTURES,
  CANONICAL_KNOWLEDGE_RELATION_FIXTURES,
  toKnowledgeObjectFixture,
} from "./knowledge-fixtures";
import { KNOWLEDGE_TOPICS } from "./knowledge.schema";

describe("canonical knowledge fixtures", () => {
  it("covers every founder-named education topic at least once", () => {
    const topics = new Set(
      CANONICAL_KNOWLEDGE_FIXTURES.map((row) => row.topic),
    );
    expect([...topics].sort()).toEqual([...KNOWLEDGE_TOPICS].sort());
  });

  it("keeps stable ids so seed re-application stays idempotent", () => {
    const ids = CANONICAL_KNOWLEDGE_FIXTURES.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
    expect(CANONICAL_KNOWLEDGE_RELATION_FIXTURES).toHaveLength(2);
  });

  it("marks unapproved editorial placeholders inactive and ineligible", () => {
    const inactive = CANONICAL_KNOWLEDGE_FIXTURES.filter((row) => !row.active);
    expect(inactive.length).toBeGreaterThan(0);
    for (const row of inactive) {
      expect(
        isKnowledgeObjectEligible({ active: row.active, isHidden: false }),
      ).toBe(false);
      expect(toKnowledgeObjectFixture(row).active).toBe(false);
    }
  });

  it("explains why, fit, tradeoffs, and value across active fixtures", () => {
    const corpus = CANONICAL_KNOWLEDGE_FIXTURES.filter((row) => row.active)
      .map((row) => `${row.summary} ${row.body}`.toLowerCase())
      .join(" ");
    expect(corpus).toMatch(/why|suit|tradeoff|value|longevity|comfort/);
  });
});
