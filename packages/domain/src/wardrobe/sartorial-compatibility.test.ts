import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  evaluateOutfitCompatibility,
  isExplanationComplete,
  type EvaluateOutfitCompatibilityInput,
} from "./sartorial-compatibility";

const ruleId = asId<"KnowledgeObjectId">(
  "00000000-0000-4000-8000-000000000001",
);
const conceptNavy = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-000000000010",
);
const conceptBrown = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-000000000011",
);
const conceptClash = asId<"MetadataConceptId">(
  "00000000-0000-4000-8000-000000000012",
);

function baseInput(
  overrides: Partial<EvaluateOutfitCompatibilityInput> = {},
): EvaluateOutfitCompatibilityInput {
  return {
    slots: [
      {
        slotKind: "jacket",
        displayLabel: "Navy jacket",
        conceptIds: [conceptNavy],
        available: true,
      },
      {
        slotKind: "trousers",
        displayLabel: "Grey trousers",
        conceptIds: [conceptBrown],
        available: true,
      },
      {
        slotKind: "shirt",
        displayLabel: "White shirt",
        conceptIds: [],
        available: true,
      },
      {
        slotKind: "shoes",
        displayLabel: "Brown loafers",
        conceptIds: [conceptBrown],
        available: true,
      },
    ],
    rules: [
      {
        knowledgeObjectId: ruleId,
        title: "Styling compatibility basics",
        summary: "Neutral fixture cites approved concepts for complete looks.",
        conceptIds: [conceptNavy, conceptBrown],
      },
    ],
    conceptEdges: [
      {
        sourceConceptId: conceptNavy,
        targetConceptId: conceptBrown,
        kind: "compatible_with",
      },
    ],
    ...overrides,
  };
}

describe("evaluateOutfitCompatibility", () => {
  it("returns compatible looks with approved rule citations", () => {
    const result = evaluateOutfitCompatibility(baseInput());
    expect(result.compatible).toBe(true);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.knowledgeObjectId).toBe(ruleId);
    expect(isExplanationComplete(result)).toBe(true);
  });

  it("flags incompatible concept pairings", () => {
    const result = evaluateOutfitCompatibility(
      baseInput({
        conceptEdges: [
          {
            sourceConceptId: conceptNavy,
            targetConceptId: conceptClash,
            kind: "incompatible_with",
          },
        ],
        slots: baseInput().slots.map((slot) =>
          slot.slotKind === "jacket"
            ? { ...slot, conceptIds: [conceptNavy, conceptClash] }
            : slot,
        ),
      }),
    );
    expect(result.compatible).toBe(false);
    expect(
      result.conflicts.some((c) => c.code === "incompatible_concepts"),
    ).toBe(true);
  });

  it("flags missing core slots and unavailable items", () => {
    const missing = evaluateOutfitCompatibility(
      baseInput({
        slots: baseInput().slots.filter((s) => s.slotKind !== "shoes"),
      }),
    );
    expect(missing.conflicts.some((c) => c.code === "missing_slot")).toBe(true);

    const unavailable = evaluateOutfitCompatibility(
      baseInput({
        slots: baseInput().slots.map((slot) =>
          slot.slotKind === "shirt" ? { ...slot, available: false } : slot,
        ),
      }),
    );
    expect(
      unavailable.conflicts.some((c) => c.code === "unavailable_item"),
    ).toBe(true);
  });

  it("requires citations for a positive compatibility outcome", () => {
    const result = evaluateOutfitCompatibility(
      baseInput({
        rules: [],
      }),
    );
    expect(result.compatible).toBe(false);
    expect(result.citations).toHaveLength(0);
  });
});
