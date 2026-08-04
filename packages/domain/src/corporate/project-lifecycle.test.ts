import { describe, expect, it } from "vitest";

import {
  assessProjectStall,
  checkAdvanceProjectStage,
  CORPORATE_PROJECT_STAGES,
  nextProjectStage,
  PROJECT_STALL_THRESHOLD_DAYS,
  type CorporateProjectStage,
} from "./project-lifecycle";

describe("checkAdvanceProjectStage", () => {
  it("allows exactly the one legal next step, in order, for every stage", () => {
    for (let i = 0; i < CORPORATE_PROJECT_STAGES.length - 1; i++) {
      const from = CORPORATE_PROJECT_STAGES[i]!;
      const to = CORPORATE_PROJECT_STAGES[i + 1]!;
      expect(checkAdvanceProjectStage({ from, to })).toEqual({
        ok: true,
        to,
      });
    }
  });

  it("refuses skipping ahead", () => {
    const result = checkAdvanceProjectStage({
      from: "award",
      to: "production",
    });
    expect(result).toEqual({ ok: false, reason: "transition_not_allowed" });
  });

  it("refuses moving backward", () => {
    const result = checkAdvanceProjectStage({
      from: "fitting",
      to: "employee_import",
    });
    expect(result).toEqual({ ok: false, reason: "transition_not_allowed" });
  });

  it("refuses any move out of the terminal stage", () => {
    const result = checkAdvanceProjectStage({
      from: "renewal",
      to: "renewal",
    });
    expect(result).toEqual({ ok: false, reason: "terminal_stage" });
  });
});

describe("nextProjectStage", () => {
  it("walks the full chain from opportunity to renewal", () => {
    let stage: CorporateProjectStage | null = "opportunity";
    const visited: CorporateProjectStage[] = [];
    while (stage !== null) {
      visited.push(stage);
      stage = nextProjectStage(stage);
    }
    expect(visited).toEqual(CORPORATE_PROJECT_STAGES);
  });

  it("returns null at the terminal stage", () => {
    expect(nextProjectStage("renewal")).toBeNull();
  });
});

describe("assessProjectStall", () => {
  it("is not stalled just under the threshold", () => {
    const now = new Date("2026-08-05T00:00:00Z");
    const stageEnteredAt = new Date(
      now.getTime() - PROJECT_STALL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = assessProjectStall({
      stage: "production",
      stageEnteredAt,
      now,
    });
    expect(result.stalled).toBe(false);
    expect(result.daysInStage).toBe(PROJECT_STALL_THRESHOLD_DAYS);
  });

  it("is stalled once strictly past the threshold", () => {
    const now = new Date("2026-08-05T00:00:00Z");
    const stageEnteredAt = new Date(
      now.getTime() - (PROJECT_STALL_THRESHOLD_DAYS + 1) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = assessProjectStall({
      stage: "production",
      stageEnteredAt,
      now,
    });
    expect(result.stalled).toBe(true);
    expect(result.daysInStage).toBe(PROJECT_STALL_THRESHOLD_DAYS + 1);
  });

  it("never flags the renewal stage as stalled", () => {
    const now = new Date("2026-08-05T00:00:00Z");
    const stageEnteredAt = new Date(
      now.getTime() - 999 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = assessProjectStall({
      stage: "renewal",
      stageEnteredAt,
      now,
    });
    expect(result.stalled).toBe(false);
  });
});
