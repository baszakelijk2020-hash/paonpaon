import { describe, expect, it } from "vitest";

import {
  assessRenewalRisk,
  computeCorporateProgrammeMetrics,
  shouldCreateRenewalTask,
} from "./renewal-analytics";

describe("computeCorporateProgrammeMetrics", () => {
  it("computes rates from raw counts", () => {
    const metrics = computeCorporateProgrammeMetrics({
      wearerCount: 10,
      activeWearerCount: 8,
      fulfilledWearerCount: 5,
      damageEventCount: 2,
    });
    expect(metrics.participationRate).toBe(0.8);
    expect(metrics.fulfilmentRate).toBe(0.5);
    expect(metrics.damageRatePerWearer).toBe(0.2);
  });

  it("never divides by zero for an empty programme", () => {
    const metrics = computeCorporateProgrammeMetrics({
      wearerCount: 0,
      activeWearerCount: 0,
      fulfilledWearerCount: 0,
      damageEventCount: 0,
    });
    expect(metrics.participationRate).toBe(0);
    expect(metrics.fulfilmentRate).toBe(0);
    expect(metrics.damageRatePerWearer).toBe(0);
  });
});

describe("assessRenewalRisk", () => {
  it("scores a healthy programme as low risk", () => {
    const metrics = computeCorporateProgrammeMetrics({
      wearerCount: 10,
      activeWearerCount: 10,
      fulfilledWearerCount: 10,
      damageEventCount: 0,
    });
    const result = assessRenewalRisk(metrics);
    expect(result.level).toBe("low");
    expect(result.score).toBe(0);
  });

  it("scores a struggling programme as high risk with contributing factors", () => {
    const metrics = computeCorporateProgrammeMetrics({
      wearerCount: 10,
      activeWearerCount: 2,
      fulfilledWearerCount: 1,
      damageEventCount: 10,
    });
    const result = assessRenewalRisk(metrics);
    expect(result.level).toBe("high");
    expect(result.factors).toHaveLength(3);
    expect(result.factors.map((f) => f.factor)).toEqual([
      "low_participation",
      "low_fulfilment",
      "damage_rate",
    ]);
  });

  it("caps the damage-rate factor at 1 even with more damage events than wearers", () => {
    const metrics = computeCorporateProgrammeMetrics({
      wearerCount: 5,
      activeWearerCount: 5,
      fulfilledWearerCount: 5,
      damageEventCount: 50,
    });
    const result = assessRenewalRisk(metrics);
    const damageFactor = result.factors.find((f) => f.factor === "damage_rate");
    expect(damageFactor?.value).toBe(1);
  });
});

describe("shouldCreateRenewalTask", () => {
  it("creates a task for medium or high risk with no open task", () => {
    expect(
      shouldCreateRenewalTask({ level: "medium", hasOpenTask: false }),
    ).toBe(true);
    expect(shouldCreateRenewalTask({ level: "high", hasOpenTask: false })).toBe(
      true,
    );
  });

  it("never creates a second task while one is already open", () => {
    expect(shouldCreateRenewalTask({ level: "high", hasOpenTask: true })).toBe(
      false,
    );
  });

  it("never creates a task for low risk", () => {
    expect(shouldCreateRenewalTask({ level: "low", hasOpenTask: false })).toBe(
      false,
    );
  });
});
