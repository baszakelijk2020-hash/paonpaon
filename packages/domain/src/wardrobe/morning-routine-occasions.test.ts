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
});
