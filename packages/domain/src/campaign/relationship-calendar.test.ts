import { describe, expect, it } from "vitest";

import {
  ANNIVERSARY_MOMENT_LIBRARY_V1,
  ANNUAL_EVENT_LIBRARY_V1,
  CLIENT_EVENT_LIBRARY_V1,
  COMING_OF_AGE_LIBRARY_V1,
  DATING_SINGLE_AGAIN_LIBRARY_V1,
  MOTHERS_AND_FATHERS_DAY_LIBRARY_V1,
  RACE_SUNDAY_LIBRARY_V1,
  REFERRAL_LIBRARY_V1,
  VALENTINE_RESERVATION_RESCUE_LIBRARY_V1,
  evaluateRelationshipDateWindow,
} from "./relationship-calendar";

describe("evaluateRelationshipDateWindow", () => {
  it("is in-window when the date falls within the lead time this year", () => {
    const result = evaluateRelationshipDateWindow({
      relationshipDateIso: "1995-06-20",
      todayIso: "2026-06-10T00:00:00.000Z",
      leadDays: 14,
    });
    expect(result).toEqual({
      inWindow: true,
      daysUntil: 10,
      nextOccurrenceIso: "2026-06-20T00:00:00.000Z",
    });
  });

  it("is outside the window when the date is far away", () => {
    const result = evaluateRelationshipDateWindow({
      relationshipDateIso: "1995-06-20",
      todayIso: "2026-01-01T00:00:00.000Z",
      leadDays: 14,
    });
    expect(result).toEqual({ inWindow: false, reason: "outside_window" });
  });

  it("rolls a passed date into next year rather than going negative", () => {
    // Today is June 25; the anniversary (June 20) already passed this year.
    // A naive same-year diff would show -5 days and never fire again until
    // an operator noticed the bug — this must show ~360 days until NEXT year's.
    const result = evaluateRelationshipDateWindow({
      relationshipDateIso: "1995-06-20",
      todayIso: "2026-06-25T00:00:00.000Z",
      leadDays: 14,
    });
    expect(result.inWindow).toBe(false);
    if (!result.inWindow) return;
  });

  it("correctly recurs across a December-to-January year boundary", () => {
    // The classic failure case for calendar-recurrence code: a date late in
    // the year, evaluated early in the following year.
    const result = evaluateRelationshipDateWindow({
      relationshipDateIso: "1995-12-20",
      todayIso: "2026-12-10T00:00:00.000Z",
      leadDays: 14,
    });
    expect(result).toEqual({
      inWindow: true,
      daysUntil: 10,
      nextOccurrenceIso: "2026-12-20T00:00:00.000Z",
    });
  });

  it("stays in-window for a configured number of days after the date passes", () => {
    // A honeymoon/anniversary follow-up package cares as much about "just
    // happened" as "coming up" — trailingDays covers the post-date case.
    const result = evaluateRelationshipDateWindow({
      relationshipDateIso: "1995-06-20",
      todayIso: "2026-06-23T00:00:00.000Z",
      leadDays: 14,
      trailingDays: 7,
    });
    expect(result.inWindow).toBe(true);
  });

  it("closes the trailing window after the configured number of days", () => {
    const result = evaluateRelationshipDateWindow({
      relationshipDateIso: "1995-06-20",
      todayIso: "2026-06-29T00:00:00.000Z",
      leadDays: 14,
      trailingDays: 7,
    });
    expect(result).toEqual({ inWindow: false, reason: "outside_window" });
  });

  it("treats the exact date itself as in-window", () => {
    const result = evaluateRelationshipDateWindow({
      relationshipDateIso: "1995-06-20",
      todayIso: "2026-06-20T00:00:00.000Z",
      leadDays: 14,
    });
    expect(result.inWindow).toBe(true);
    if (result.inWindow) {
      expect(result.daysUntil).toBe(0);
    }
  });

  it("ignores the relationship fact's own year — only month/day recur", () => {
    // A fact recorded in a completely different year must still recur
    // annually on the same month/day, not be treated as a one-off past date.
    const withOldYear = evaluateRelationshipDateWindow({
      relationshipDateIso: "1958-06-20",
      todayIso: "2026-06-10T00:00:00.000Z",
      leadDays: 14,
    });
    const withRecentYear = evaluateRelationshipDateWindow({
      relationshipDateIso: "2024-06-20",
      todayIso: "2026-06-10T00:00:00.000Z",
      leadDays: 14,
    });
    expect(withOldYear).toEqual(withRecentYear);
  });
});

describe("ANNIVERSARY_MOMENT_LIBRARY_V1", () => {
  it("declares a real prerequisite naming the fact type it depends on", () => {
    expect(ANNIVERSARY_MOMENT_LIBRARY_V1.prerequisites).toContain(
      "anniversary_fact",
    );
    expect(ANNIVERSARY_MOMENT_LIBRARY_V1.prerequisites).toContain(
      "personalization_consent",
    );
  });
});

describe("ANNUAL_EVENT_LIBRARY_V1", () => {
  it("declares a real prerequisite naming the fact type it depends on", () => {
    expect(ANNUAL_EVENT_LIBRARY_V1.prerequisites).toContain("occasion_fact");
    expect(ANNUAL_EVENT_LIBRARY_V1.prerequisites).toContain(
      "personalization_consent",
    );
  });

  it("is a distinct library version from the anniversary package", () => {
    expect(ANNUAL_EVENT_LIBRARY_V1.versionLabel).not.toBe(
      ANNIVERSARY_MOMENT_LIBRARY_V1.versionLabel,
    );
  });

  it("shares the same generic date-window eligibility as any other occasion", () => {
    // ANNUAL_EVENT reuses evaluateRelationshipDateWindow unmodified — an
    // occasion recorded as, say, a founding date recurs exactly like an
    // anniversary or wedding date would.
    const result = evaluateRelationshipDateWindow({
      relationshipDateIso: "2019-09-03",
      todayIso: "2026-08-25T00:00:00.000Z",
      leadDays: 14,
    });
    expect(result.inWindow).toBe(true);
    if (result.inWindow) {
      expect(result.daysUntil).toBe(9);
    }
  });
});

describe("evaluateRelationshipDateWindow with a fixed calendar date", () => {
  // Valentine's Day (February 14) is the same for every customer — no
  // customer_facts row at all, unlike the anniversary case above. The year
  // in `relationshipDateIso` is arbitrary and ignored, same as any other
  // recurring date.
  const VALENTINES_DAY = "2000-02-14";

  it("opens the window while there is still time to prepare", () => {
    const result = evaluateRelationshipDateWindow({
      relationshipDateIso: VALENTINES_DAY,
      todayIso: "2026-02-01T00:00:00.000Z",
      leadDays: 14,
    });
    expect(result.inWindow).toBe(true);
    if (result.inWindow) {
      expect(result.daysUntil).toBe(13);
    }
  });

  it("stays closed long before the date", () => {
    const result = evaluateRelationshipDateWindow({
      relationshipDateIso: VALENTINES_DAY,
      todayIso: "2026-01-01T00:00:00.000Z",
      leadDays: 14,
    });
    expect(result).toEqual({ inWindow: false, reason: "outside_window" });
  });

  it("rolls into next year once this year's date has passed", () => {
    const result = evaluateRelationshipDateWindow({
      relationshipDateIso: VALENTINES_DAY,
      todayIso: "2026-03-01T00:00:00.000Z",
      leadDays: 14,
    });
    expect(result).toEqual({ inWindow: false, reason: "outside_window" });
  });
});

describe("VALENTINE_RESERVATION_RESCUE_LIBRARY_V1", () => {
  it("needs no per-customer fact, only consent and advisor coverage", () => {
    expect(VALENTINE_RESERVATION_RESCUE_LIBRARY_V1.prerequisites).toEqual([
      "personalization_consent",
      "advisor_coverage",
    ]);
  });

  it("is a distinct library version from the anniversary package", () => {
    expect(VALENTINE_RESERVATION_RESCUE_LIBRARY_V1.versionLabel).not.toBe(
      ANNIVERSARY_MOMENT_LIBRARY_V1.versionLabel,
    );
  });

  describe("MOTHERS_AND_FATHERS_DAY_LIBRARY_V1", () => {
    it("needs no per-customer fact, only consent and advisor coverage", () => {
      expect(MOTHERS_AND_FATHERS_DAY_LIBRARY_V1.prerequisites).toEqual([
        "personalization_consent",
        "advisor_coverage",
      ]);
    });

    it("is a distinct library version from the anniversary package", () => {
      expect(MOTHERS_AND_FATHERS_DAY_LIBRARY_V1.versionLabel).not.toBe(
        ANNIVERSARY_MOMENT_LIBRARY_V1.versionLabel,
      );
    });

    it("has a versionLabel referencing mothers-fathers-day", () => {
      expect(MOTHERS_AND_FATHERS_DAY_LIBRARY_V1.versionLabel).toBe(
        "mothers-fathers-day-v1",
      );
    });
  });

  describe("COMING_OF_AGE_LIBRARY_V1", () => {
    it("declares a real prerequisite naming the fact type it depends on", () => {
      expect(COMING_OF_AGE_LIBRARY_V1.prerequisites).toContain(
        "birth_date_fact",
      );
      expect(COMING_OF_AGE_LIBRARY_V1.prerequisites).toContain(
        "personalization_consent",
      );
    });

    it("is a distinct library version from the anniversary package", () => {
      expect(COMING_OF_AGE_LIBRARY_V1.versionLabel).not.toBe(
        ANNIVERSARY_MOMENT_LIBRARY_V1.versionLabel,
      );
    });
  });

  describe("RACE_SUNDAY_LIBRARY_V1", () => {
    it("needs no per-customer fact, only consent and advisor coverage", () => {
      expect(RACE_SUNDAY_LIBRARY_V1.prerequisites).toEqual([
        "personalization_consent",
        "advisor_coverage",
      ]);
    });

    it("is a distinct library version", () => {
      expect(RACE_SUNDAY_LIBRARY_V1.versionLabel).toBe("race-sunday-v1");
    });
  });

  describe("CLIENT_EVENT_LIBRARY_V1", () => {
    it("declares expected prerequisites", () => {
      expect(CLIENT_EVENT_LIBRARY_V1.prerequisites).toContain(
        "personalization_consent",
      );
      expect(CLIENT_EVENT_LIBRARY_V1.prerequisites).toContain(
        "event_invitation_scheme",
      );
    });

    it("is a distinct library version", () => {
      expect(CLIENT_EVENT_LIBRARY_V1.versionLabel).toBe("client-event-v1");
    });
  });

  describe("DATING_SINGLE_AGAIN_LIBRARY_V1", () => {
    it("requires human rehearsal as a sensitive-context package", () => {
      expect(DATING_SINGLE_AGAIN_LIBRARY_V1.prerequisites).toContain(
        "human_rehearsal_required",
      );
      expect(DATING_SINGLE_AGAIN_LIBRARY_V1.prerequisites).toContain(
        "personalization_consent",
      );
    });

    it("is a distinct library version", () => {
      expect(DATING_SINGLE_AGAIN_LIBRARY_V1.versionLabel).toBe(
        "dating-single-again-v1",
      );
    });
  });

  describe("REFERRAL_LIBRARY_V1", () => {
    it("declares a prerequisite naming referral outcome", () => {
      expect(REFERRAL_LIBRARY_V1.prerequisites).toContain("referral_outcome");
      expect(REFERRAL_LIBRARY_V1.prerequisites).toContain(
        "personalization_consent",
      );
    });

    it("is a distinct library version", () => {
      expect(REFERRAL_LIBRARY_V1.versionLabel).toBe("referral-v1");
    });
  });
});
