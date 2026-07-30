import { describe, expect, it } from "vitest";

import { projectIntelligenceHealth } from "./intelligence-observability";

describe("intelligence observability", () => {
  it("projects aggregate health without customer content", () => {
    const health = projectIntelligenceHealth({
      generatedAt: "2026-07-30T12:00:00.000Z",
      eventCount24h: 100,
      ingestionLagSecondsP95: 120,
      correctionCount7d: 2,
      opportunityCount7d: 20,
      incorrectOpportunityCount7d: 1,
      suppressedInsightCount7d: 10,
      projectorVersionCounts: [
        { version: "customer-interest-v1", count: 40 },
        { version: "for-you-v1", count: 12 },
      ],
    });

    expect(health.explainabilityHealth).toBe("healthy");
    expect(health.correctionCount7d).toBe(2);
    expect(health.projectorVersions[0]?.version).toBe("customer-interest-v1");
  });

  it("marks degraded health when ingestion lag is high", () => {
    const health = projectIntelligenceHealth({
      generatedAt: "2026-07-30T12:00:00.000Z",
      eventCount24h: 10,
      ingestionLagSecondsP95: 7200,
      correctionCount7d: 0,
      opportunityCount7d: 0,
      incorrectOpportunityCount7d: 0,
      suppressedInsightCount7d: 0,
      projectorVersionCounts: [],
    });
    expect(health.explainabilityHealth).toBe("degraded");
  });
});
