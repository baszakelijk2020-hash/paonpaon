import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  assessAdjustmentRisk,
  checkAdjustmentApproval,
  reconcileSweep,
  resolveSweepDiscrepancy,
  summarizeRiskCoverage,
} from "./loss-prevention";

describe("assessAdjustmentRisk", () => {
  const base = {
    valueMinorUnits: 1000,
    highValueThresholdMinorUnits: 50000,
    priorAdjustmentsSameVariant: 0,
    withinCountSession: true,
  };

  it("passes an ordinary in-session adjustment", () => {
    const result = assessAdjustmentRisk(base);
    expect(result.triggered).toEqual([]);
    expect(result.requiresIndependentApproval).toBe(false);
  });

  it("flags a high-value adjustment", () => {
    expect(
      assessAdjustmentRisk({ ...base, valueMinorUnits: 80000 }).triggered,
    ).toContain("high_value_adjustment");
  });

  it("flags an adjustment made outside any count session", () => {
    expect(
      assessAdjustmentRisk({ ...base, withinCountSession: false }).triggered,
    ).toContain("adjustment_outside_count_session");
  });

  it("flags repetition on the same variant", () => {
    expect(
      assessAdjustmentRisk({ ...base, priorAdjustmentsSameVariant: 3 })
        .triggered,
    ).toContain("repeated_adjustment_same_variant");
  });

  it("accepts no staff identity at all", () => {
    // A risk rule fires on the shape of a transaction, never on who did
    // it. Keeping identity out of the signature is what makes the
    // "no employee accusation score" non-goal structural.
    const source = readFileSync(
      new URL("./loss-prevention.ts", import.meta.url),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    const assessSignature = source.slice(
      source.indexOf("export function assessAdjustmentRisk"),
      source.indexOf("): RiskAssessment"),
    );
    expect(assessSignature).not.toMatch(/staffId|employee|userId/i);
  });
});

describe("checkAdjustmentApproval", () => {
  const flagged = assessAdjustmentRisk({
    valueMinorUnits: 80000,
    highValueThresholdMinorUnits: 50000,
    priorAdjustmentsSameVariant: 0,
    withinCountSession: true,
  });
  const clean = assessAdjustmentRisk({
    valueMinorUnits: 100,
    highValueThresholdMinorUnits: 50000,
    priorAdjustmentsSameVariant: 0,
    withinCountSession: true,
  });

  it("requires no approval when nothing was flagged", () => {
    expect(
      checkAdjustmentApproval({
        assessment: clean,
        requestedByStaffId: "a",
        approverIsManager: false,
      }),
    ).toEqual({ ok: true });
  });

  it("requires an approver on a flagged adjustment", () => {
    expect(
      checkAdjustmentApproval({
        assessment: flagged,
        requestedByStaffId: "a",
        approverIsManager: false,
      }),
    ).toEqual({ ok: false, reason: "independent_approval_required" });
  });

  it("refuses self-approval even by a manager", () => {
    expect(
      checkAdjustmentApproval({
        assessment: flagged,
        requestedByStaffId: "a",
        approverStaffId: "a",
        approverIsManager: true,
      }),
    ).toEqual({ ok: false, reason: "self_approval_not_allowed" });
  });

  it("refuses a peer approving a peer", () => {
    // A different person is necessary but not sufficient.
    expect(
      checkAdjustmentApproval({
        assessment: flagged,
        requestedByStaffId: "a",
        approverStaffId: "b",
        approverIsManager: false,
      }),
    ).toEqual({ ok: false, reason: "approver_lacks_authority" });
  });

  it("accepts an independent manager", () => {
    expect(
      checkAdjustmentApproval({
        assessment: flagged,
        requestedByStaffId: "a",
        approverStaffId: "b",
        approverIsManager: true,
      }),
    ).toEqual({ ok: true });
  });
});

describe("reconcileSweep", () => {
  const observations = [
    { epc: "E1", zoneKey: "floor", observedAt: "t", readConfidence: 0.95 },
    { epc: "E1", zoneKey: "floor", observedAt: "t", readConfidence: 0.91 },
    { epc: "E2", zoneKey: "floor", observedAt: "t", readConfidence: 0.4 },
    { epc: "E9", zoneKey: "stockroom", observedAt: "t", readConfidence: 0.99 },
  ];

  it("counts a tag once no matter how many times the reader saw it", () => {
    // A reader passing the same jacket four times has seen one jacket.
    // Counting four is how an RFID pilot invents a surplus on day one.
    const result = reconcileSweep({
      observations,
      expectedEpcs: ["E1"],
      zoneKey: "floor",
    });
    expect(result.presentEpcs).toEqual(["E1"]);
  });

  it("never posts a balance change", () => {
    // The load-bearing property: a sweep produces observations, and only a
    // human count adjustment through the 13.1 ledger moves stock.
    const result = reconcileSweep({
      observations,
      expectedEpcs: ["E1", "E5"],
      zoneKey: "floor",
    });
    expect(result.postsBalanceChange).toBe(false);
  });

  it("calls an expected-but-unseen tag unobserved, not missing", () => {
    // A tag can be unread for a dozen mundane reasons. Calling it missing
    // invites a write-off.
    const result = reconcileSweep({
      observations,
      expectedEpcs: ["E1", "E5"],
      zoneKey: "floor",
    });
    expect(result.unobservedEpcs).toEqual(["E5"]);
    expect(Object.keys(result)).not.toContain("missingEpcs");
  });

  it("keeps low-confidence reads visible instead of discarding them", () => {
    // Otherwise a poor sweep looks exactly like a clean one.
    const result = reconcileSweep({
      observations,
      expectedEpcs: ["E1", "E2"],
      zoneKey: "floor",
    });
    expect(result.lowConfidenceReadCount).toBe(1);
    expect(result.unobservedEpcs).toEqual(["E2"]);
  });

  it("ignores observations from a different zone", () => {
    const result = reconcileSweep({
      observations,
      expectedEpcs: ["E1"],
      zoneKey: "floor",
    });
    expect(result.unexpectedEpcs).toEqual([]);
  });

  it("reports an unexpected tag as probably mis-shelved", () => {
    const result = reconcileSweep({
      observations,
      expectedEpcs: [],
      zoneKey: "floor",
    });
    expect(result.unexpectedEpcs).toEqual(["E1"]);
  });
});

describe("resolveSweepDiscrepancy", () => {
  it("requires a note, because 'resolved' with no reason means 'ignored'", () => {
    expect(
      resolveSweepDiscrepancy({ open: true, resolutionNote: "ok" }),
    ).toEqual({ ok: false, reason: "resolution_note_required" });
    expect(
      resolveSweepDiscrepancy({
        open: true,
        resolutionNote: "Found behind the fitting room mirror.",
      }),
    ).toEqual({ ok: true });
  });

  it("refuses to re-resolve a closed discrepancy", () => {
    expect(
      resolveSweepDiscrepancy({ open: false, resolutionNote: "Found it." }),
    ).toEqual({ ok: false, reason: "not_an_open_discrepancy" });
  });
});

describe("summarizeRiskCoverage", () => {
  it("reports locations and counts, never people", () => {
    const coverage = summarizeRiskCoverage({
      flags: [
        { locationId: "amsterdam", approved: false },
        { locationId: "amsterdam", approved: true },
        { locationId: "rotterdam", approved: false },
      ],
    });
    expect(coverage).toEqual({
      flaggedAdjustmentCount: 3,
      awaitingApprovalCount: 2,
      locationsWithOpenFlags: ["amsterdam", "rotterdam"],
    });
    // A "who triggers the most flags" view cannot be built from this,
    // because the identity never enters the function.
    expect(JSON.stringify(coverage)).not.toMatch(/staff|employee/i);
  });
});
