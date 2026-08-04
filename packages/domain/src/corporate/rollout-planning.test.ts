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

  it("allows a company-wide day (no siteKey) for any wearer", () => {
    expect(
      checkAssignWearerToDay({
        currentlyAssignedCount: 0,
        capacity: 1,
        wearerSiteKey: "london",
      }),
    ).toEqual({ ok: true });
  });

  it("allows a site-scoped day for a matching wearer", () => {
    expect(
      checkAssignWearerToDay({
        currentlyAssignedCount: 0,
        capacity: 1,
        daySiteKey: "london",
        wearerSiteKey: "london",
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a site-scoped day for a wearer from a different site", () => {
    expect(
      checkAssignWearerToDay({
        currentlyAssignedCount: 0,
        capacity: 1,
        daySiteKey: "london",
        wearerSiteKey: "manchester",
      }),
    ).toEqual({ ok: false, reason: "site_mismatch" });
  });

  it("refuses a site-scoped day for a wearer with no site at all", () => {
    expect(
      checkAssignWearerToDay({
        currentlyAssignedCount: 0,
        capacity: 1,
        daySiteKey: "london",
      }),
    ).toEqual({ ok: false, reason: "site_mismatch" });
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

  it("never reslots onto a different site's day even if it has spare capacity", () => {
    const result = planNoShowReslot({
      candidateDays: [
        {
          rolloutDayId: "manchester-day",
          fittingDate: "2026-02-01",
          currentlyAssignedCount: 0,
          capacity: 5,
          siteKey: "manchester",
        },
      ],
      wearerSiteKey: "london",
    });
    expect(result).toEqual({ ok: false, reason: "no_capacity_available" });
  });

  it("prefers an earlier company-wide day over a later matching-site day, and skips a full same-site day", () => {
    const result = planNoShowReslot({
      candidateDays: [
        {
          rolloutDayId: "london-full",
          fittingDate: "2026-02-01",
          currentlyAssignedCount: 1,
          capacity: 1,
          siteKey: "london",
        },
        {
          rolloutDayId: "company-wide",
          fittingDate: "2026-02-02",
          currentlyAssignedCount: 0,
          capacity: 1,
        },
        {
          rolloutDayId: "manchester-open",
          fittingDate: "2026-02-01",
          currentlyAssignedCount: 0,
          capacity: 1,
          siteKey: "manchester",
        },
      ],
      wearerSiteKey: "london",
    });
    expect(result).toEqual({ ok: true, rolloutDayId: "company-wide" });
  });
});
