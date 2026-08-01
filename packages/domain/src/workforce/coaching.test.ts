import { describe, expect, it } from "vitest";

import {
  checkCeremonyPublish,
  checkCoachingTransition,
  checkObservation,
  selectCeremonyPrompts,
  summarizeCoachingLoop,
  type CeremonyVersion,
} from "./coaching";

const ceremony: CeremonyVersion = {
  ceremonyKey: "first_fitting",
  version: 2,
  published: true,
  steps: [
    {
      key: "greet",
      title: "Greet by name",
      guidance: "Use the client's name.",
    },
    {
      key: "welcome_first_visit",
      title: "Orient a first-time client",
      guidance: "Walk the floor before measuring.",
      appliesWhen: { customerIsFirstVisit: true },
    },
    {
      key: "alteration_followup",
      title: "Close the open alteration",
      guidance: "Confirm the pickup date.",
      appliesWhen: { hasOpenAlteration: true },
    },
  ],
};

describe("selectCeremonyPrompts", () => {
  it("always includes unconditional steps", () => {
    const steps = selectCeremonyPrompts({ version: ceremony, context: {} });
    expect(steps.map((s) => s.key)).toEqual(["greet"]);
  });

  it("includes a conditional step when its context matches", () => {
    const steps = selectCeremonyPrompts({
      version: ceremony,
      context: { customerIsFirstVisit: true, hasOpenAlteration: false },
    });
    expect(steps.map((s) => s.key)).toEqual(["greet", "welcome_first_visit"]);
  });

  it("treats an undeclared context field as 'do not filter', not as false", () => {
    // Adding a new context field later must not silently switch off steps
    // that never mentioned it.
    const steps = selectCeremonyPrompts({
      version: ceremony,
      context: { hasOpenAlteration: true },
    });
    expect(steps.map((s) => s.key)).toContain("alteration_followup");
  });

  it("surfaces nothing from an unpublished version", () => {
    expect(
      selectCeremonyPrompts({
        version: { ...ceremony, published: false },
        context: {},
      }),
    ).toEqual([]);
  });
});

describe("checkCeremonyPublish", () => {
  const draft: CeremonyVersion = { ...ceremony, version: 3, published: false };

  it("publishes a well-formed next version", () => {
    expect(
      checkCeremonyPublish({ candidate: draft, latestPublishedVersion: 2 }),
    ).toEqual({ ok: true });
  });

  it("refuses to re-publish an already published version", () => {
    expect(
      checkCeremonyPublish({
        candidate: { ...draft, published: true },
        latestPublishedVersion: 2,
      }),
    ).toEqual({ ok: false, reason: "already_published" });
  });

  it("refuses a version number that would restate history", () => {
    // An observation cites the version it was made against; reusing a
    // number retroactively changes what that citation means.
    expect(
      checkCeremonyPublish({ candidate: draft, latestPublishedVersion: 3 }),
    ).toEqual({ ok: false, reason: "version_not_incremented" });
  });

  it("refuses an empty ceremony", () => {
    expect(
      checkCeremonyPublish({ candidate: { ...draft, steps: [] } }),
    ).toEqual({ ok: false, reason: "no_steps" });
  });

  it("refuses duplicate step keys", () => {
    expect(
      checkCeremonyPublish({
        candidate: {
          ...draft,
          steps: [
            { key: "greet", title: "A", guidance: "x" },
            { key: "greet", title: "B", guidance: "y" },
          ],
        },
      }),
    ).toEqual({ ok: false, reason: "duplicate_step_key" });
  });
});

describe("checkObservation", () => {
  const scores = [
    {
      criterionKey: "discovery",
      score: 3 as const,
      evidence: "Asked about the wedding date before showing fabric.",
    },
  ];

  it("accepts an evidenced observation of a colleague", () => {
    expect(
      checkObservation({
        observedStaffId: "staff-1",
        observerStaffId: "manager-1",
        scores,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses self-observation", () => {
    expect(
      checkObservation({
        observedStaffId: "manager-1",
        observerStaffId: "manager-1",
        scores,
      }),
    ).toEqual({ ok: false, reason: "self_observation_not_allowed" });
  });

  it("refuses a score with no evidence behind it", () => {
    expect(
      checkObservation({
        observedStaffId: "staff-1",
        observerStaffId: "manager-1",
        scores: [{ criterionKey: "discovery", score: 1, evidence: "bad" }],
      }),
    ).toEqual({ ok: false, reason: "score_without_evidence" });
  });

  it("refuses an empty rubric", () => {
    expect(
      checkObservation({
        observedStaffId: "staff-1",
        observerStaffId: "manager-1",
        scores: [],
      }),
    ).toEqual({ ok: false, reason: "no_criteria_scored" });
  });

  it("refuses the same criterion scored twice", () => {
    expect(
      checkObservation({
        observedStaffId: "staff-1",
        observerStaffId: "manager-1",
        scores: [...scores, ...scores],
      }),
    ).toEqual({ ok: false, reason: "duplicate_criterion" });
  });
});

describe("checkCoachingTransition", () => {
  it("advances one step at a time", () => {
    expect(
      checkCoachingTransition({ current: "observed", next: "discussed" }),
    ).toEqual({ ok: true });
  });

  it("refuses to skip the discussion", () => {
    // Closing a coaching record the employee was never told about is the
    // exact failure this loop exists to prevent.
    expect(
      checkCoachingTransition({
        current: "observed",
        next: "outcome_recorded",
        outcomeNote: "Improved",
      }),
    ).toEqual({ ok: false, reason: "out_of_order_transition" });
  });

  it("refuses to go backwards", () => {
    expect(
      checkCoachingTransition({ current: "plan_agreed", next: "observed" }),
    ).toEqual({ ok: false, reason: "out_of_order_transition" });
  });

  it("refuses a plan with no agreed action", () => {
    expect(
      checkCoachingTransition({
        current: "discussed",
        next: "plan_agreed",
        agreedAction: "   ",
      }),
    ).toEqual({ ok: false, reason: "plan_requires_agreed_action" });
  });

  it("refuses an outcome with no note", () => {
    expect(
      checkCoachingTransition({
        current: "plan_agreed",
        next: "outcome_recorded",
      }),
    ).toEqual({ ok: false, reason: "outcome_requires_plan" });
  });

  it("has no transition out of the closed state", () => {
    expect(
      checkCoachingTransition({
        current: "outcome_recorded",
        next: "discussed",
      }),
    ).toEqual({ ok: false, reason: "out_of_order_transition" });
  });
});

describe("summarizeCoachingLoop", () => {
  it("names staff whose loop stalled rather than scoring anyone", () => {
    const summary = summarizeCoachingLoop({
      asOf: "2026-08-01T00:00:00.000Z",
      observations: [
        {
          observedStaffId: "staff-1",
          state: "observed",
          observedOn: "2026-07-01T00:00:00.000Z",
        },
        {
          observedStaffId: "staff-2",
          state: "outcome_recorded",
          observedOn: "2026-07-01T00:00:00.000Z",
        },
        {
          observedStaffId: "staff-3",
          state: "discussed",
          observedOn: "2026-07-30T00:00:00.000Z",
        },
      ],
    });
    expect(summary.stalledStaffIds).toEqual(["staff-1"]);
    expect(summary.closedLoopCount).toBe(1);
    expect(summary.awaitingPlanCount).toBe(2);
  });

  it("exposes no per-person rubric average or ranking", () => {
    // Same non-goal as 11.2's recognition: an average score per advisor is
    // a performance ranking wearing a coaching costume.
    const summary = summarizeCoachingLoop({
      asOf: "2026-08-01T00:00:00.000Z",
      observations: [],
    });
    expect(Object.keys(summary)).toEqual([
      "openObservationCount",
      "awaitingPlanCount",
      "closedLoopCount",
      "stalledStaffIds",
    ]);
  });

  it("does not treat a recently observed staff member as stalled", () => {
    const summary = summarizeCoachingLoop({
      asOf: "2026-08-01T00:00:00.000Z",
      observations: [
        {
          observedStaffId: "staff-1",
          state: "observed",
          observedOn: "2026-07-29T00:00:00.000Z",
        },
      ],
    });
    expect(summary.stalledStaffIds).toEqual([]);
  });
});
