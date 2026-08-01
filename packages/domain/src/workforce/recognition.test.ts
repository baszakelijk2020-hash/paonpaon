import { describe, expect, it } from "vitest";

import {
  checkRecognitionReview,
  checkRecognitionSubmission,
  summarizeRecognitionCoverage,
} from "./recognition";

describe("checkRecognitionSubmission", () => {
  it("accepts a substantive narrative", () => {
    expect(
      checkRecognitionSubmission({
        narrative: "Stayed late to re-press a jacket before a client's flight.",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a narrative too short to mean anything", () => {
    expect(checkRecognitionSubmission({ narrative: "good" })).toEqual({
      ok: false,
      reason: "narrative_too_short",
    });
  });

  it("rejects whitespace padding used to clear the length floor", () => {
    expect(checkRecognitionSubmission({ narrative: "  ok        " })).toEqual({
      ok: false,
      reason: "narrative_too_short",
    });
  });
});

describe("checkRecognitionReview", () => {
  const submitted = { staffId: "staff-1", reviewState: "submitted" } as const;

  it("allows a different manager to acknowledge", () => {
    expect(
      checkRecognitionReview({
        act: submitted,
        reviewerStaffId: "manager-1",
        nextState: "acknowledged",
      }),
    ).toEqual({ ok: true });
  });

  it("refuses self-review even for a legitimate manager", () => {
    // RLS can confirm the caller is a manager; it cannot know the act is
    // about that same manager. This is the gap this check exists to close.
    expect(
      checkRecognitionReview({
        act: submitted,
        reviewerStaffId: "staff-1",
        nextState: "acknowledged",
      }),
    ).toEqual({ ok: false, reason: "self_review_not_allowed" });
  });

  it("refuses to review an act that was already reviewed", () => {
    expect(
      checkRecognitionReview({
        act: { staffId: "staff-1", reviewState: "acknowledged" },
        reviewerStaffId: "manager-1",
        nextState: "coached",
        coachingNote: "Consider offering the loan garment next time.",
      }),
    ).toEqual({ ok: false, reason: "already_reviewed" });
  });

  it("refuses a coaching state with no coaching note", () => {
    expect(
      checkRecognitionReview({
        act: submitted,
        reviewerStaffId: "manager-1",
        nextState: "coached",
      }),
    ).toEqual({ ok: false, reason: "coaching_requires_note" });
  });

  it("refuses a coaching note that is only whitespace", () => {
    expect(
      checkRecognitionReview({
        act: submitted,
        reviewerStaffId: "manager-1",
        nextState: "coached",
        coachingNote: "   ",
      }),
    ).toEqual({ ok: false, reason: "coaching_requires_note" });
  });

  it("allows dismissal without a note", () => {
    expect(
      checkRecognitionReview({
        act: submitted,
        reviewerStaffId: "manager-1",
        nextState: "dismissed",
      }),
    ).toEqual({ ok: true });
  });
});

describe("summarizeRecognitionCoverage", () => {
  it("reports who has received no recognition, not who has the most", () => {
    const coverage = summarizeRecognitionCoverage({
      allStaffIds: ["staff-1", "staff-2", "staff-3"],
      acts: [
        { staffId: "staff-1", reviewState: "acknowledged" },
        { staffId: "staff-1", reviewState: "acknowledged" },
        { staffId: "staff-1", reviewState: "coached" },
        { staffId: "staff-2", reviewState: "acknowledged" },
      ],
    });
    expect(coverage.recognizedStaffCount).toBe(2);
    expect(coverage.totalStaffCount).toBe(3);
    expect(coverage.unrecognizedStaffIds).toEqual(["staff-3"]);
  });

  it("exposes no per-person count or ranking at all", () => {
    // Guards this item's non-goal structurally: if someone later adds a
    // count or rank field to satisfy a "leaderboard" request, this test
    // fails and forces the conversation back to PHASE.md's non-goal.
    const coverage = summarizeRecognitionCoverage({
      allStaffIds: ["staff-1", "staff-2"],
      acts: [
        { staffId: "staff-1", reviewState: "acknowledged" },
        { staffId: "staff-1", reviewState: "acknowledged" },
      ],
    });
    const keys = Object.keys(coverage);
    expect(keys).toEqual([
      "recognizedStaffCount",
      "totalStaffCount",
      "unrecognizedStaffIds",
      "awaitingReviewCount",
    ]);
    expect(JSON.stringify(coverage)).not.toContain('staff-1":2');
  });

  it("counts an unreviewed act as awaiting review, not as recognition", () => {
    const coverage = summarizeRecognitionCoverage({
      allStaffIds: ["staff-1"],
      acts: [{ staffId: "staff-1", reviewState: "submitted" }],
    });
    expect(coverage.awaitingReviewCount).toBe(1);
    expect(coverage.recognizedStaffCount).toBe(0);
    expect(coverage.unrecognizedStaffIds).toEqual(["staff-1"]);
  });

  it("does not let a dismissed act count as coverage for that employee", () => {
    // Otherwise a manager could clear their "unrecognized" list by
    // dismissing acts rather than by recognizing people.
    const coverage = summarizeRecognitionCoverage({
      allStaffIds: ["staff-1"],
      acts: [{ staffId: "staff-1", reviewState: "dismissed" }],
    });
    expect(coverage.recognizedStaffCount).toBe(0);
    expect(coverage.unrecognizedStaffIds).toEqual(["staff-1"]);
  });

  it("handles an empty team without dividing by zero or throwing", () => {
    const coverage = summarizeRecognitionCoverage({
      allStaffIds: [],
      acts: [],
    });
    expect(coverage).toEqual({
      recognizedStaffCount: 0,
      totalStaffCount: 0,
      unrecognizedStaffIds: [],
      awaitingReviewCount: 0,
    });
  });
});
