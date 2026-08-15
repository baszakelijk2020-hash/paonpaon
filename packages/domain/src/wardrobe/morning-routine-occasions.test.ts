import { describe, expect, it } from "vitest";

import { selectUpcomingOccasions } from "./morning-routine-occasions";

describe("selectUpcomingOccasions", () => {
  it("surfaces a dated fact within the lead window, nearest first", () => {
    const result = selectUpcomingOccasions({
      facts: [
        {
          factId: "fact-anniversary",
          factType: "anniversary",
          valueLabel: "1995-06-20",
        },
        {
          factId: "fact-wedding",
          factType: "wedding_date",
          valueLabel: "2026-06-15",
          valueText: "Their own wedding, not a client's",
        },
      ],
      todayIso: "2026-06-10T00:00:00.000Z",
      leadDays: 30,
    });

    expect(result).toEqual([
      {
        factId: "fact-wedding",
        factType: "wedding_date",
        label: "Wedding date",
        note: "Their own wedding, not a client's",
        nextOccurrenceIso: "2026-06-15T00:00:00.000Z",
        daysUntil: 5,
      },
      {
        factId: "fact-anniversary",
        factType: "anniversary",
        label: "Anniversary",
        nextOccurrenceIso: "2026-06-20T00:00:00.000Z",
        daysUntil: 10,
      },
    ]);
  });

  it("excludes a fact whose next occurrence falls outside the lead window", () => {
    const result = selectUpcomingOccasions({
      facts: [
        {
          factId: "fact-far",
          factType: "anniversary",
          valueLabel: "1995-12-20",
        },
      ],
      todayIso: "2026-06-10T00:00:00.000Z",
      leadDays: 30,
    });
    expect(result).toEqual([]);
  });

  it("never guesses at a non-ISO value — silently skips it, no crash", () => {
    const result = selectUpcomingOccasions({
      facts: [
        {
          factId: "fact-garbage",
          factType: "anniversary",
          valueLabel: "sometime in June",
        },
      ],
      todayIso: "2026-06-10T00:00:00.000Z",
      leadDays: 30,
    });
    expect(result).toEqual([]);
  });

  it("ignores fact types that aren't date-bearing occasions", () => {
    const result = selectUpcomingOccasions({
      facts: [
        {
          factId: "fact-employer",
          factType: "employer",
          valueLabel: "2026-06-15",
        },
      ],
      todayIso: "2026-06-10T00:00:00.000Z",
      leadDays: 30,
    });
    expect(result).toEqual([]);
  });

  // The module's contract is that a fact whose value isn't a clean ISO date is
  // "silently skipped, never guessed at". A shape-only regex satisfies that for
  // free text but not for values that look like dates and aren't: month 13 and
  // day 45 pass /^\d{4}-\d{2}-\d{2}$/, reach the recurrence math, and blow up
  // at `.toISOString()` on an Invalid Date — crashing the whole "Coming up"
  // card rather than dropping one bad fact.
  it("skips shape-valid but calendar-invalid dates instead of throwing", () => {
    expect(() =>
      selectUpcomingOccasions({
        facts: [
          {
            factId: "fact-impossible-month",
            factType: "anniversary",
            valueLabel: "2026-13-45",
          },
        ],
        todayIso: "2026-06-10T00:00:00.000Z",
        leadDays: 30,
      }),
    ).not.toThrow();
  });

  it("drops one impossible date without losing the valid facts beside it", () => {
    const result = selectUpcomingOccasions({
      facts: [
        {
          factId: "fact-impossible",
          factType: "anniversary",
          valueLabel: "2026-02-30",
        },
        {
          factId: "fact-real",
          factType: "wedding_date",
          valueLabel: "2026-06-15",
        },
      ],
      todayIso: "2026-06-10T00:00:00.000Z",
      leadDays: 30,
    });
    expect(result.map((occasion) => occasion.factId)).toEqual(["fact-real"]);
  });

  it("returns nothing for a malformed todayIso rather than NaN-sorted rows", () => {
    const result = selectUpcomingOccasions({
      facts: [
        {
          factId: "fact-real",
          factType: "wedding_date",
          valueLabel: "2026-06-15",
        },
      ],
      todayIso: "not-a-date",
      leadDays: 30,
    });
    expect(result).toEqual([]);
  });

  it("returns nothing for a non-finite leadDays rather than an unbounded window", () => {
    const result = selectUpcomingOccasions({
      facts: [
        {
          factId: "fact-real",
          factType: "wedding_date",
          valueLabel: "2026-06-15",
        },
      ],
      todayIso: "2026-06-10T00:00:00.000Z",
      leadDays: Number.NaN,
    });
    expect(result).toEqual([]);
  });
});
