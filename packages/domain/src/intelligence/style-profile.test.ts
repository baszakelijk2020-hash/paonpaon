import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  defaultPolarityForEvidenceSource,
  evidenceRecencyWeight,
  evidenceSourceFromEventName,
  hasExplicitPreferenceForConcept,
  recomputeInferredPreferences,
  removeDeclaredPreference,
  STYLE_INFERENCE_MIN_ABS_SCORE,
  suppressEvidenceForConcept,
  upsertDeclaredPreference,
  type DeclaredStylePreference,
  type StylePreferenceEvidence,
} from "./style-profile";
import {
  removeInferredStylePreferenceInputSchema,
  upsertDeclaredStylePreferenceInputSchema,
} from "./style-profile.schema";

const retailerId = asId<"RetailerId">("11111111-1111-1111-1111-111111111111");
const customerId = asId<"CustomerId">("44444444-4444-4444-4444-444444444444");
const linen = asId<"MetadataConceptId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
const wool = asId<"MetadataConceptId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2");
const navy = asId<"MetadataConceptId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3");

const now = "2026-07-30T12:00:00.000Z";

function evidence(
  partial: Pick<
    StylePreferenceEvidence,
    "id" | "conceptId" | "source" | "polarity" | "confidence" | "createdAt"
  > &
    Partial<StylePreferenceEvidence>,
): StylePreferenceEvidence {
  return {
    retailerId,
    customerId,
    ...partial,
  };
}

describe("style evidence mapping", () => {
  it("maps interaction events to evidence sources and default polarity", () => {
    expect(evidenceSourceFromEventName("product_favorited")).toBe(
      "product_favorited",
    );
    expect(evidenceSourceFromEventName("category_browsed")).toBe(
      "filter_applied",
    );
    expect(defaultPolarityForEvidenceSource("product_skipped")).toBe(
      "negative",
    );
    expect(defaultPolarityForEvidenceSource("search_performed")).toBe(
      "neutral",
    );
  });
});

describe("recency decay", () => {
  it("is 1 at age zero and halves at the half-life", () => {
    expect(
      evidenceRecencyWeight({
        createdAt: now,
        now,
      }),
    ).toBe(1);
    expect(
      evidenceRecencyWeight({
        createdAt: "2026-04-30T12:00:00.000Z",
        now,
        halfLifeDays: 91,
      }),
    ).toBeCloseTo(0.5, 1);
  });
});

describe("recomputeInferredPreferences", () => {
  it("scores positive evidence with source weight and confidence", () => {
    const result = recomputeInferredPreferences({
      explicitPreferences: [],
      evidence: [
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          ),
          conceptId: linen,
          source: "product_favorited",
          polarity: "positive",
          confidence: 1,
          createdAt: now,
        }),
      ],
      now,
    });
    expect(result.inferredPreferences).toHaveLength(1);
    expect(result.inferredPreferences[0]?.conceptId).toBe(linen);
    expect(result.inferredPreferences[0]?.polarity).toBe("positive");
    expect(result.inferredPreferences[0]?.confidence).toBe(1);
    expect(result.inferredPreferences[0]?.score).toBe(1);
    expect(
      result.inferredPreferences[0]?.factors.some(
        (factor) => factor.code === "evidence_weight",
      ),
    ).toBe(true);
  });

  it("applies recency decay so older evidence contributes less", () => {
    const fresh = recomputeInferredPreferences({
      explicitPreferences: [],
      evidence: [
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
          ),
          conceptId: wool,
          source: "product_viewed",
          polarity: "positive",
          confidence: 1,
          createdAt: now,
        }),
      ],
      now,
    });
    const stale = recomputeInferredPreferences({
      explicitPreferences: [],
      evidence: [
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3",
          ),
          conceptId: wool,
          source: "product_viewed",
          polarity: "positive",
          confidence: 1,
          createdAt: "2025-07-30T12:00:00.000Z",
        }),
      ],
      now,
    });
    expect(fresh.inferredPreferences[0]?.score ?? 0).toBeGreaterThan(
      stale.inferredPreferences[0]?.score ?? 0,
    );
  });

  it("nets contradictory evidence and explains the contradiction", () => {
    const result = recomputeInferredPreferences({
      explicitPreferences: [],
      evidence: [
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4",
          ),
          conceptId: navy,
          source: "product_favorited",
          polarity: "positive",
          confidence: 1,
          createdAt: now,
        }),
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5",
          ),
          conceptId: navy,
          source: "product_skipped",
          polarity: "negative",
          confidence: 1,
          createdAt: now,
        }),
      ],
      now,
    });
    // favorited 1.0 - skipped 0.9 = 0.1 → below threshold
    expect(result.inferredPreferences).toHaveLength(0);
    expect(STYLE_INFERENCE_MIN_ABS_SCORE).toBeGreaterThan(0.1);

    const stronger = recomputeInferredPreferences({
      explicitPreferences: [],
      evidence: [
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6",
          ),
          conceptId: navy,
          source: "conversion_recorded",
          polarity: "positive",
          confidence: 1,
          createdAt: now,
        }),
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7",
          ),
          conceptId: navy,
          source: "product_skipped",
          polarity: "negative",
          confidence: 1,
          createdAt: now,
        }),
      ],
      now,
    });
    expect(stronger.inferredPreferences).toHaveLength(1);
    expect(stronger.inferredPreferences[0]?.polarity).toBe("positive");
    expect(
      stronger.inferredPreferences[0]?.factors.some(
        (factor) => factor.code === "contradiction_net",
      ),
    ).toBe(true);
  });

  it("never lets inference overwrite an explicit preference for the same concept", () => {
    const explicit: DeclaredStylePreference[] = [
      {
        conceptId: linen,
        polarity: "negative",
        updatedAt: now,
      },
    ];
    const result = recomputeInferredPreferences({
      explicitPreferences: explicit,
      evidence: [
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8",
          ),
          conceptId: linen,
          source: "product_favorited",
          polarity: "positive",
          confidence: 1,
          createdAt: now,
        }),
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9",
          ),
          conceptId: wool,
          source: "product_favorited",
          polarity: "positive",
          confidence: 1,
          createdAt: now,
        }),
      ],
      now,
    });
    expect(hasExplicitPreferenceForConcept(explicit, linen)).toBe(true);
    expect(
      result.inferredPreferences.find((row) => row.conceptId === linen),
    ).toBeUndefined();
    expect(
      result.inferredPreferences.find((row) => row.conceptId === wool),
    ).toBeDefined();
    expect(result.confidence.explicitCount).toBe(1);
  });

  it("ignores suppressed evidence and is idempotent", () => {
    const rows = [
      evidence({
        id: asId<"StylePreferenceEvidenceId">(
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb10",
        ),
        conceptId: linen,
        source: "cart_updated",
        polarity: "positive",
        confidence: 1,
        createdAt: now,
      }),
      evidence({
        id: asId<"StylePreferenceEvidenceId">(
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb11",
        ),
        conceptId: wool,
        source: "product_favorited",
        polarity: "positive",
        confidence: 1,
        createdAt: now,
        suppressedAt: now,
        suppressedBy: "customer",
      }),
    ];
    const first = recomputeInferredPreferences({
      explicitPreferences: [],
      evidence: rows,
      now,
    });
    const second = recomputeInferredPreferences({
      explicitPreferences: [],
      evidence: rows,
      now,
    });
    expect(first).toEqual(second);
    expect(first.inferredPreferences).toHaveLength(1);
    expect(first.inferredPreferences[0]?.conceptId).toBe(linen);
    expect(first.confidence.activeEvidenceCount).toBe(1);
  });
});

describe("declared preference upsert and removal", () => {
  it("upserts by concept without touching other declarations", () => {
    const once = upsertDeclaredPreference([], {
      conceptId: linen,
      polarity: "positive",
      updatedAt: now,
    });
    const twice = upsertDeclaredPreference(once, {
      conceptId: linen,
      polarity: "negative",
      note: "Prefer wool for evenings",
      updatedAt: "2026-07-30T13:00:00.000Z",
    });
    expect(twice).toHaveLength(1);
    expect(twice[0]?.polarity).toBe("negative");
    expect(twice[0]?.note).toBe("Prefer wool for evenings");
    expect(removeDeclaredPreference(twice, linen)).toEqual([]);
  });
});

describe("customer inference removal", () => {
  it("suppresses inferred evidence without deleting rows", () => {
    const rows = [
      evidence({
        id: asId<"StylePreferenceEvidenceId">(
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb12",
        ),
        conceptId: linen,
        source: "product_favorited",
        polarity: "positive",
        confidence: 1,
        createdAt: now,
      }),
      evidence({
        id: asId<"StylePreferenceEvidenceId">(
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb13",
        ),
        conceptId: linen,
        source: "declared",
        polarity: "positive",
        confidence: 1,
        createdAt: now,
      }),
    ];
    const suppressed = suppressEvidenceForConcept({
      evidence: rows,
      conceptId: linen,
      suppressedAt: now,
      suppressedBy: "customer",
      reason: "Not accurate for me",
    });
    expect(suppressed[0]?.suppressedAt).toBe(now);
    expect(suppressed[0]?.suppressedBy).toBe("customer");
    expect(suppressed[1]?.suppressedAt).toBeUndefined();
    expect(rows[0]?.suppressedAt).toBeUndefined();
  });
});

describe("style profile schemas", () => {
  it("validates declare and remove inputs", () => {
    expect(
      upsertDeclaredStylePreferenceInputSchema.parse({
        conceptId: linen,
        polarity: "positive",
      }),
    ).toEqual({ conceptId: linen, polarity: "positive" });
    expect(
      removeInferredStylePreferenceInputSchema.parse({
        conceptId: wool,
        reason: "Wrong fabric",
      }),
    ).toEqual({ conceptId: wool, reason: "Wrong fabric" });
  });
});
