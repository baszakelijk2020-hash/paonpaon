import { describe, expect, it } from "vitest";

import {
  assessScanQuality,
  checkMeasurementApproval,
  checkReorderGate,
  decideMeasurementOutcome,
  planScanDeletionRecompute,
  SELF_SCAN_ACCURACY_NOTE,
  type MeasurementValue,
} from "./measurement-monitor";

const goodQuality = {
  captureCount: 3,
  poseConfidence: 0.92,
  landmarksDetected: 18,
  landmarksExpected: 18,
  hasScaleReference: true,
};

function tape(key: string, mm: number): MeasurementValue {
  return { key, millimetres: mm, capturedBy: "tailor_tape" };
}
function scan(key: string, mm: number): MeasurementValue {
  return { key, millimetres: mm, capturedBy: "guided_self_scan" };
}

describe("assessScanQuality", () => {
  it("passes a well-formed capture", () => {
    expect(assessScanQuality(goodQuality)).toEqual({ ok: true });
  });

  it("reports every failure at once, not just the first", () => {
    // Telling a customer "stand further back", then after they redo it
    // "we also need the reference card", makes them repeat a two-minute
    // process twice for one problem.
    const result = assessScanQuality({
      captureCount: 1,
      poseConfidence: 0.3,
      landmarksDetected: 9,
      landmarksExpected: 18,
      hasScaleReference: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.failures).toEqual([
      "insufficient_captures",
      "pose_confidence_low",
      "landmarks_incomplete",
      "scale_reference_missing",
    ]);
  });

  it("fails a scan with no scale reference even when everything else is clean", () => {
    // Without a known-size object in frame it measures proportions, not
    // centimetres.
    const result = assessScanQuality({
      ...goodQuality,
      hasScaleReference: false,
    });
    expect(result.ok).toBe(false);
  });
});

describe("decideMeasurementOutcome", () => {
  const approved = [tape("chest", 1020), tape("waist", 880)];

  it("returns no_action when everything is within tolerance", () => {
    const result = decideMeasurementOutcome({
      approved,
      candidate: [scan("chest", 1024), scan("waist", 876)],
      quality: { ok: true },
    });
    expect(result.decision).toBe("no_action");
    expect(result.deltas.every((d) => d.withinTolerance)).toBe(true);
  });

  it("escalates to an advisor rather than applying a change", () => {
    // There is no outcome that means "apply". That is the entire point.
    const result = decideMeasurementOutcome({
      approved,
      candidate: [scan("chest", 1060), scan("waist", 880)],
      quality: { ok: true },
    });
    expect(result.decision).toBe("advisor_review");
    expect(result.rationale).toContain("chest +40mm");
  });

  it("asks for a remeasure when quality failed, without comparing anything", () => {
    const result = decideMeasurementOutcome({
      approved,
      candidate: [scan("chest", 1400)],
      quality: { ok: false, failures: ["pose_confidence_low"] },
    });
    expect(result.decision).toBe("remeasure");
    expect(result.deltas).toEqual([]);
  });

  it("treats a missing measurement as missing, not as a change to zero", () => {
    const result = decideMeasurementOutcome({
      approved,
      candidate: [scan("chest", 1020)],
      quality: { ok: true },
    });
    expect(result.missingKeys).toEqual(["waist"]);
    expect(result.decision).toBe("no_action");
  });

  it("honours a per-measurement tolerance over the default", () => {
    const result = decideMeasurementOutcome({
      approved,
      candidate: [scan("chest", 1025), scan("waist", 880)],
      quality: { ok: true },
      toleranceMillimetres: { chest: 3 },
    });
    expect(result.decision).toBe("advisor_review");
  });

  it("stamps the decision-rule version on every result", () => {
    // Re-running an old scan under new rules must be visibly a different
    // decision, not a silent restatement.
    const result = decideMeasurementOutcome({
      approved,
      candidate: [],
      quality: { ok: true },
    });
    expect(result.decisionVersion).toBe(1);
  });
});

describe("checkMeasurementApproval", () => {
  const base = {
    values: [tape("chest", 1020)],
    nextVersion: 2,
    latestApprovedVersion: 1,
    approvedByStaffId: "staff-1",
  };

  it("accepts a properly incremented advisor-taken version", () => {
    expect(checkMeasurementApproval(base)).toEqual({ ok: true });
  });

  it("refuses to reuse a version number", () => {
    // 12.2's production spec pins a measurementVersionId; reusing one
    // would change what a garment was cut to after the fact.
    expect(checkMeasurementApproval({ ...base, nextVersion: 1 })).toEqual({
      ok: false,
      reason: "version_not_incremented",
    });
  });

  it("requires a review note when the values came from a self-scan", () => {
    expect(
      checkMeasurementApproval({ ...base, values: [scan("chest", 1020)] }),
    ).toEqual({ ok: false, reason: "review_note_required" });
  });

  it("accepts self-scan values once an advisor has written a note", () => {
    expect(
      checkMeasurementApproval({
        ...base,
        values: [scan("chest", 1020)],
        reviewNote: "Re-measured by hand at the fitting; scan agreed.",
      }),
    ).toEqual({ ok: true });
  });

  it("refuses false precision and impossible values", () => {
    expect(
      checkMeasurementApproval({
        ...base,
        values: [
          { key: "chest", millimetres: 1020.4, capturedBy: "tailor_tape" },
        ],
      }),
    ).toEqual({ ok: false, reason: "non_integer_millimetres" });
    expect(
      checkMeasurementApproval({ ...base, values: [tape("chest", 0)] }),
    ).toEqual({ ok: false, reason: "non_integer_millimetres" });
  });

  it("refuses an unsigned approval", () => {
    expect(
      checkMeasurementApproval({ ...base, approvedByStaffId: "  " }),
    ).toEqual({ ok: false, reason: "self_scan_cannot_self_approve" });
  });

  it("refuses duplicate keys", () => {
    expect(
      checkMeasurementApproval({
        ...base,
        values: [tape("chest", 1020), tape("chest", 1030)],
      }),
    ).toEqual({ ok: false, reason: "duplicate_measurement_key" });
  });
});

describe("checkReorderGate", () => {
  it("allows a reorder pinned to the current version", () => {
    expect(
      checkReorderGate({
        pinnedVersion: 3,
        latestApprovedVersion: 3,
        openAdvisorReviewCount: 0,
      }),
    ).toEqual({ allowed: true });
  });

  it("refuses while an advisor review is open", () => {
    expect(
      checkReorderGate({
        pinnedVersion: 3,
        latestApprovedVersion: 3,
        openAdvisorReviewCount: 1,
      }),
    ).toEqual({ allowed: false, reason: "open_advisor_review" });
  });

  it("refuses a reorder pinned to a superseded version", () => {
    // A repeat order is exactly when a stale measurement does real damage.
    expect(
      checkReorderGate({
        pinnedVersion: 2,
        latestApprovedVersion: 3,
        openAdvisorReviewCount: 0,
      }),
    ).toEqual({ allowed: false, reason: "measurement_version_superseded" });
  });

  it("refuses when nothing has ever been approved", () => {
    expect(checkReorderGate({ openAdvisorReviewCount: 0 })).toEqual({
      allowed: false,
      reason: "no_approved_measurements",
    });
  });
});

describe("planScanDeletionRecompute", () => {
  it("deletes derived candidates but retains approved versions", () => {
    // A candidate is derived data. An approved version is a record of a
    // human decision, and a garment may already have been cut to it.
    const plan = planScanDeletionRecompute({
      scanId: "scan-1",
      candidates: [
        { candidateId: "cand-1", sourceScanId: "scan-1" },
        { candidateId: "cand-2", sourceScanId: "scan-2" },
      ],
      approvedVersions: [{ versionId: "ver-1", sourceScanId: "scan-1" }],
    });
    expect(plan.candidateIdsToDelete).toEqual(["cand-1"]);
    expect(plan.approvedVersionIdsToRetain).toEqual(["ver-1"]);
  });
});

describe("accuracy claims", () => {
  it("states in code that a self-scan is not a measurement of record", () => {
    expect(SELF_SCAN_ACCURACY_NOTE).toContain("not a measurement of record");
  });
});
