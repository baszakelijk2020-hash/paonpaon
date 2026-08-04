import { describe, expect, it } from "vitest";

import { checkAssignWearerToDay, planNoShowReslot } from "./rollout-planning";

describe("checkAssignWearerToDay", () => {
  it("allows assignment below capacity", () => {
    expect(
      checkAssignWearerToDay({ currentlyAssignedCount: 0, capacity: 1 }),
    ).toEqual({ ok: true });
  });

  it("refuses assignment at capacity", () => {
    expect(
      checkAssignWearerToDay({ currentlyAssignedCount: 1, capacity: 1 }),
    ).toEqual({ ok: false, reason: "day_at_capacity" });
  });

  it("refuses assignment over capacity", () => {
    expect(
      checkAssignWearerToDay({ currentlyAssignedCount: 3, capacity: 2 }),
    ).toEqual({ ok: false, reason: "day_at_capacity" });
  });
});

describe("planNoShowReslot", () => {
  it("picks the earliest day with spare capacity", () => {
    const result = planNoShowReslot({
      candidateDays: [
        {
          rolloutDayId: "day-2",
          fittingDate: "2026-02-02",
          currentlyAssignedCount: 0,
          capacity: 1,
        },
        {
          rolloutDayId: "day-1",
          fittingDate: "2026-02-01",
          currentlyAssignedCount: 1,
          capacity: 1,
        },
        {
          rolloutDayId: "day-3",
          fittingDate: "2026-02-03",
          currentlyAssignedCount: 0,
          capacity: 1,
        },
      ],
    });
    expect(result).toEqual({ ok: true, rolloutDayId: "day-2" });
  });

  it("refuses rather than silently dropping the wearer when no day has capacity", () => {
    const result = planNoShowReslot({
      candidateDays: [
        {
          rolloutDayId: "day-1",
          fittingDate: "2026-02-01",
          currentlyAssignedCount: 1,
          capacity: 1,
        },
      ],
    });
    expect(result).toEqual({ ok: false, reason: "no_capacity_available" });
  });

  it("treats an empty candidate list the same as no capacity", () => {
    expect(planNoShowReslot({ candidateDays: [] })).toEqual({
      ok: false,
      reason: "no_capacity_available",
    });
  });
});
