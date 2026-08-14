import { describe, expect, it } from "vitest";

import {
  assessConfidence,
  buildRecommendation,
  buildRoleDashboard,
  checkRecommendationHonesty,
  findBusiestSlot,
  findMostCommonLookGap,
  planRecompute,
} from "./cited-recommendation";

const sources = [
  {
    sourceRef: "appointments_projection",
    projectorVersion: "v3",
    observedRows: 420,
  },
];
const window = {
  from: "2026-05-01T00:00:00.000Z",
  to: "2026-08-01T00:00:00.000Z",
};

describe("buildRecommendation", () => {
  it("builds a fully cited recommendation", () => {
    const result = buildRecommendation({
      kind: "temporal_hotspot",
      statement: "Saturday 11:00-13:00 carries 31% of fittings.",
      sources,
      window,
      sampleSize: 420,
    });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("unreachable");
    expect(result.recommendation.confidence).toBe("supported");
  });

  it("refuses a recommendation with no source", () => {
    // The non-goal is "no black-box owner dashboard". Refusing at
    // construction beats validating later: a partially-cited
    // recommendation that exists in memory will eventually be rendered.
    expect(
      buildRecommendation({
        kind: "stock_risk",
        statement: "Navy is running low.",
        sources: [],
        window,
        sampleSize: 5,
      }),
    ).toEqual({ ok: false, reason: "no_sources" });
  });

  it("refuses a source with no projector version", () => {
    expect(
      buildRecommendation({
        kind: "stock_risk",
        statement: "Navy is running low.",
        sources: [
          { sourceRef: "stock", projectorVersion: "  ", observedRows: 100 },
        ],
        window,
        sampleSize: 10,
      }),
    ).toEqual({ ok: false, reason: "projector_version_required" });
  });

  it("refuses an inverted or zero-length window", () => {
    expect(
      buildRecommendation({
        kind: "fit_risk",
        statement: "x",
        sources,
        window: { from: window.to, to: window.from },
        sampleSize: 10,
      }),
    ).toEqual({ ok: false, reason: "window_invalid" });
  });

  it("refuses a sample larger than the sources actually contain", () => {
    // The most direct way to make a weak finding look strong.
    expect(
      buildRecommendation({
        kind: "fit_risk",
        statement: "Sleeve returns cluster on one block.",
        sources: [
          { sourceRef: "returns", projectorVersion: "v1", observedRows: 12 },
        ],
        window,
        sampleSize: 400,
      }),
    ).toEqual({ ok: false, reason: "sample_exceeds_observed_rows" });
  });

  it("refuses an empty statement and a non-positive sample", () => {
    expect(
      buildRecommendation({
        kind: "fit_risk",
        statement: "  ",
        sources,
        window,
        sampleSize: 10,
      }),
    ).toEqual({ ok: false, reason: "statement_required" });
    expect(
      buildRecommendation({
        kind: "fit_risk",
        statement: "x",
        sources,
        window,
        sampleSize: 0,
      }),
    ).toEqual({ ok: false, reason: "sample_size_not_positive" });
  });
});

describe("assessConfidence", () => {
  it("bands rather than inventing a percentage", () => {
    // "73% confident" from a sample of nine means nothing but reads as
    // though it does.
    expect(assessConfidence(4)).toBe("insufficient_sample");
    expect(assessConfidence(10)).toBe("indicative");
    expect(assessConfidence(50)).toBe("supported");
  });
});

describe("planRecompute", () => {
  const recommendations = [
    { kind: "fit_risk" as const, derivedFromFactIds: ["fact-1", "fact-2"] },
    { kind: "stock_risk" as const, derivedFromFactIds: ["fact-9"] },
  ];

  it("finds everything derived from a corrected fact", () => {
    const plan = planRecompute({
      correctedFactIds: ["fact-2"],
      recommendations,
    });
    expect(plan.staleRecommendationKinds).toEqual(["fit_risk"]);
    expect(plan.noOp).toBe(false);
  });

  it("reports a no-op when nothing depended on the fact", () => {
    expect(
      planRecompute({ correctedFactIds: ["fact-77"], recommendations }).noOp,
    ).toBe(true);
  });
});

describe("checkRecommendationHonesty", () => {
  it("refuses to offer stock that is not there", () => {
    expect(
      checkRecommendationHonesty({ promisedQuantity: 3, availableQuantity: 1 }),
    ).toEqual({ ok: false, reason: "claims_stock_it_does_not_have" });
  });

  it("refuses a lead time shorter than the supplier's own", () => {
    expect(
      checkRecommendationHonesty({
        quotedLeadTimeDays: 14,
        supplierLeadTimeDays: 42,
      }),
    ).toEqual({ ok: false, reason: "lead_time_shorter_than_supplier_states" });
  });

  it("refuses to imply an advisor is there when the roster says otherwise", () => {
    expect(
      checkRecommendationHonesty({
        impliesAdvisorPresent: true,
        advisorRostered: false,
      }),
    ).toEqual({ ok: false, reason: "claims_staff_presence_not_rostered" });
  });

  it("passes a claim that matches reality", () => {
    expect(
      checkRecommendationHonesty({
        promisedQuantity: 1,
        availableQuantity: 1,
        quotedLeadTimeDays: 42,
        supplierLeadTimeDays: 42,
        impliesAdvisorPresent: true,
        advisorRostered: true,
      }),
    ).toEqual({ ok: true });
  });

  it("does not invent a failure when nothing was claimed", () => {
    expect(checkRecommendationHonesty({})).toEqual({ ok: true });
  });
});

describe("buildRoleDashboard", () => {
  function make(kind: "fit_risk" | "stock_risk", sampleSize: number) {
    const result = buildRecommendation({
      kind,
      statement: "s",
      sources: [{ sourceRef: "x", projectorVersion: "v1", observedRows: 1000 }],
      window,
      sampleSize,
    });
    if (!result.ok) throw new Error("fixture invalid");
    return result.recommendation;
  }

  it("keeps a low-sample recommendation and labels it, rather than hiding it", () => {
    // Silently dropping it makes a sparse dataset look confident, which is
    // the same lie as overstating confidence, told by omission.
    const sections = buildRoleDashboard({
      recommendations: [make("fit_risk", 4)],
      allowedKinds: ["fit_risk"],
    });
    expect(sections).toHaveLength(1);
    expect(sections[0]?.recommendations[0]?.confidence).toBe(
      "insufficient_sample",
    );
  });

  it("omits a kind this role is not allowed to see", () => {
    const sections = buildRoleDashboard({
      recommendations: [make("fit_risk", 60), make("stock_risk", 60)],
      allowedKinds: ["fit_risk"],
    });
    expect(sections.map((s) => s.kind)).toEqual(["fit_risk"]);
  });

  it("omits an allowed kind that has nothing in it, rather than showing an empty panel", () => {
    expect(
      buildRoleDashboard({
        recommendations: [],
        allowedKinds: ["fit_risk", "stock_risk"],
      }),
    ).toEqual([]);
  });
});

describe("findBusiestSlot", () => {
  it("returns null for no appointments", () => {
    expect(findBusiestSlot([])).toBeNull();
  });

  it("finds the day/hour bucket with the most appointments", () => {
    // Three on a Saturday (2026-08-01 is a Saturday) at 14:00 UTC, one
    // elsewhere — the bucket with 3 must win.
    const result = findBusiestSlot([
      "2026-08-01T14:05:00.000Z",
      "2026-08-01T14:40:00.000Z",
      "2026-08-08T14:10:00.000Z", // a different Saturday, same bucket
      "2026-08-02T09:00:00.000Z", // Sunday 09:00 — one, does not win
    ]);
    expect(result).toEqual({ dayOfWeek: 6, hour: 14, count: 3 });
  });

  it("counts every appointment, not just distinct buckets", () => {
    const result = findBusiestSlot([
      "2026-08-03T10:00:00.000Z",
      "2026-08-10T10:00:00.000Z",
      "2026-08-17T10:00:00.000Z",
    ]);
    expect(result?.count).toBe(3);
  });
});

describe("findMostCommonLookGap", () => {
  it("returns null for no customers", () => {
    expect(findMostCommonLookGap([])).toBeNull();
  });

  it("finds the category the most customers are missing", () => {
    const result = findMostCommonLookGap([
      ["shirt", "shoes"],
      ["shirt"],
      ["shirt", "trousers"],
      ["shoes"],
    ]);
    expect(result).toEqual({ categoryCode: "shirt", customerCount: 3 });
  });

  it("counts a customer at most once per category regardless of repeats", () => {
    const result = findMostCommonLookGap([
      ["shirt", "shirt", "shirt"],
      ["shoes"],
    ]);
    expect(result).toEqual({ categoryCode: "shirt", customerCount: 1 });
  });

  it("breaks a tie by first-seen category, matching findBusiestSlot's own tie behaviour", () => {
    const result = findMostCommonLookGap([["shirt"], ["shoes"]]);
    expect(result?.customerCount).toBe(1);
    expect(["shirt", "shoes"]).toContain(result?.categoryCode);
  });
});
