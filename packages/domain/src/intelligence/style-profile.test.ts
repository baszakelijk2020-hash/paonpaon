import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import type {
  ExplicitStylePreference,
  StyleEvidenceInput,
} from "./style-profile";
import { interactionStyleEvidenceHints } from "./style-profile-interaction";
import {
  recomputeStyleProfile,
  STYLE_EVIDENCE_HALF_LIFE_DAYS,
  STYLE_INFERENCE_SCORE_THRESHOLD,
} from "./style-profile-recompute";

const conceptA = asId<"MetadataConceptId">(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
);
const conceptB = asId<"MetadataConceptId">(
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
);
const conceptC = asId<"MetadataConceptId">(
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
);

const evidenceId = asId<"StylePreferenceEvidenceId">(
  "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
);

function evidence(
  overrides: Partial<StyleEvidenceInput> &
    Pick<StyleEvidenceInput, "conceptId">,
): StyleEvidenceInput {
  return {
    id: evidenceId,
    polarity: "positive",
    confidence: 0.9,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("recomputeStyleProfile", () => {
  it("aggregates positive evidence with recency decay into explainable scores", () => {
    const now = "2026-07-29T00:00:00.000Z";
    const result = recomputeStyleProfile({
      explicitPreferences: [],
      evidence: [
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "11111111-1111-4111-8111-111111111111",
          ),
          conceptId: conceptA,
          createdAt: "2026-07-20T00:00:00.000Z",
          confidence: 0.8,
        }),
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "22222222-2222-4222-8222-222222222222",
          ),
          conceptId: conceptA,
          createdAt: "2026-07-01T00:00:00.000Z",
          confidence: 0.9,
        }),
      ],
      now,
    });

    expect(result.inferredPreferences).toHaveLength(1);
    const inferred = result.inferredPreferences[0];
    expect(inferred?.conceptId).toBe(conceptA);
    expect(inferred?.polarity).toBe("positive");
    expect(inferred?.evidenceCount).toBe(2);
    expect(inferred?.factors).toHaveLength(2);
    expect(inferred?.score).toBeGreaterThan(STYLE_INFERENCE_SCORE_THRESHOLD);
  });

  it("applies contradictory evidence with net scoring", () => {
    const now = "2026-07-29T00:00:00.000Z";
    const result = recomputeStyleProfile({
      explicitPreferences: [],
      evidence: [
        evidence({
          conceptId: conceptB,
          polarity: "positive",
          confidence: 0.9,
          createdAt: now,
        }),
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "33333333-3333-4333-8333-333333333333",
          ),
          conceptId: conceptB,
          polarity: "negative",
          confidence: 0.9,
          createdAt: now,
        }),
      ],
      now,
    });

    expect(result.inferredPreferences).toHaveLength(0);
  });

  it("excludes concepts with explicit declarations from inferred output", () => {
    const explicit: ExplicitStylePreference[] = [
      {
        conceptId: conceptA,
        polarity: "negative",
        declaredAt: "2026-07-01T00:00:00.000Z",
      },
    ];
    const result = recomputeStyleProfile({
      explicitPreferences: explicit,
      evidence: [
        evidence({
          conceptId: conceptA,
          polarity: "positive",
          confidence: 0.95,
          createdAt: "2026-07-28T00:00:00.000Z",
        }),
        evidence({
          id: asId<"StylePreferenceEvidenceId">(
            "44444444-4444-4444-8444-444444444444",
          ),
          conceptId: conceptC,
          polarity: "positive",
          confidence: 0.9,
          createdAt: "2026-07-28T00:00:00.000Z",
        }),
      ],
      now: "2026-07-29T00:00:00.000Z",
    });

    expect(result.inferredPreferences.map((pref) => pref.conceptId)).toEqual([
      conceptC,
    ]);
  });

  it("is idempotent for the same evidence and timestamps", () => {
    const input = {
      explicitPreferences: [] as ExplicitStylePreference[],
      evidence: [
        evidence({
          conceptId: conceptA,
          createdAt: "2026-07-15T00:00:00.000Z",
        }),
      ],
      now: "2026-07-29T00:00:00.000Z",
    };
    expect(recomputeStyleProfile(input)).toEqual(recomputeStyleProfile(input));
  });

  it("decays older evidence below the inference threshold", () => {
    const now = "2026-12-29T00:00:00.000Z";
    const oldCreatedAt = new Date(
      Date.parse(now) - STYLE_EVIDENCE_HALF_LIFE_DAYS * 4 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const result = recomputeStyleProfile({
      explicitPreferences: [],
      evidence: [
        evidence({
          conceptId: conceptA,
          polarity: "neutral",
          confidence: 0.3,
          createdAt: oldCreatedAt,
        }),
      ],
      now,
    });

    expect(result.inferredPreferences).toHaveLength(0);
  });
});

describe("interactionStyleEvidenceHints", () => {
  it("maps swipe favorites to positive high-confidence hints", () => {
    const hints = interactionStyleEvidenceHints({
      name: "product_favorited",
      properties: { conceptIds: [conceptA] },
    });
    expect(hints).toEqual([
      { conceptId: conceptA, polarity: "positive", confidence: 0.9 },
    ]);
  });

  it("falls back to accepted product concept assignments", () => {
    const hints = interactionStyleEvidenceHints({
      name: "product_skipped",
      properties: { productId: "prod-1" },
      acceptedConceptIds: [conceptB],
    });
    expect(hints[0]?.polarity).toBe("negative");
    expect(hints[0]?.conceptId).toBe(conceptB);
  });
});
