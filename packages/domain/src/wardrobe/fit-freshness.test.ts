import { describe, expect, it } from "vitest";

import { projectFitFreshness, FIT_FRESHNESS_THRESHOLDS } from "./fit-freshness";

describe("projectFitFreshness", () => {
  const now = "2026-07-30T12:00:00.000Z";

  it("returns never_measured when no official date exists", () => {
    const result = projectFitFreshness({ lastOfficialMeasuredAt: null, now });
    expect(result.level).toBe("never_measured");
    expect(result.suggestedAction).toBe("book_fitting");
  });

  it("escalates through deterministic thresholds", () => {
    const current = projectFitFreshness({
      lastOfficialMeasuredAt: "2026-04-01T00:00:00.000Z",
      now,
    });
    expect(current.level).toBe("current");
    expect(current.suggestedAction).toBe("none");

    const dueSoon = projectFitFreshness({
      lastOfficialMeasuredAt: "2025-10-01T00:00:00.000Z",
      now,
    });
    expect(dueSoon.level).toBe("due_soon");
    expect(dueSoon.suggestedAction).toBe("book_fitting");

    const stale = projectFitFreshness({
      lastOfficialMeasuredAt: "2025-01-01T00:00:00.000Z",
      now,
    });
    expect(stale.level).toBe("stale");

    const veryStale = projectFitFreshness({
      lastOfficialMeasuredAt: "2020-01-01T00:00:00.000Z",
      now,
    });
    expect(veryStale.level).toBe("very_stale");
    expect(veryStale.suggestedAction).toBe("discuss_alteration");
  });

  it("uses only the supplied official measurement date", () => {
    const result = projectFitFreshness({
      lastOfficialMeasuredAt: "2026-04-15T00:00:00.000Z",
      now,
    });
    expect(result.lastOfficialMeasuredAt).toBe("2026-04-15T00:00:00.000Z");
    expect(result.level).toBe("current");
    expect(result.daysSinceOfficialMeasurement).toBeLessThanOrEqual(
      FIT_FRESHNESS_THRESHOLDS.currentMaxDays,
    );
  });
});
