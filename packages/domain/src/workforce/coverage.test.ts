import { describe, expect, it } from "vitest";

import {
  buildCitation,
  checkSwapApproval,
  checkSwapRequest,
  recommendCoverage,
  type CoveragePlan,
  type ScheduledShift,
} from "./coverage";

const plan: CoveragePlan = {
  retailerId: "retailer-1",
  planDate: "2026-08-08",
  timezone: "Europe/Amsterdam",
  state: "published",
  intervals: [
    { startTime: "10:00", endTime: "14:00", requiredHeadcount: 2 },
    {
      startTime: "14:00",
      endTime: "18:00",
      requiredHeadcount: 2,
      requiredSkills: ["mtm_fitting"],
    },
  ],
};

function shift(overrides: Partial<ScheduledShift>): ScheduledShift {
  return {
    staffId: "staff-1",
    startTime: "10:00",
    endTime: "18:00",
    sourceRef: "staff_shifts:shift-1",
    ...overrides,
  };
}

describe("recommendCoverage", () => {
  it("returns nothing when every interval is met", () => {
    const result = recommendCoverage({
      plan,
      shifts: [
        shift({
          staffId: "a",
          sourceRef: "staff_shifts:a",
          skills: ["mtm_fitting"],
        }),
        shift({ staffId: "b", sourceRef: "staff_shifts:b" }),
      ],
    });
    expect(result).toEqual([]);
  });

  it("reports a shortfall with the arithmetic visible in the rationale", () => {
    const result = recommendCoverage({
      plan,
      shifts: [shift({ staffId: "a", skills: ["mtm_fitting"] })],
    });
    const headcount = result.filter(
      (entry) => entry.kind === "headcount_below_requirement",
    );
    expect(headcount).toHaveLength(2);
    expect(headcount[0]?.shortfall).toBe(1);
    expect(headcount[0]?.rationale).toContain("1 of 2 scheduled");
  });

  it("never emits a recommendation without at least one citation", () => {
    // The programme forbids a black-box recommendation. Even the worst case
    // — nobody scheduled at all, so no shift rows to cite — must still cite
    // the plan the requirement came from.
    const result = recommendCoverage({ plan, shifts: [] });
    expect(result.length).toBeGreaterThan(0);
    for (const recommendation of result) {
      expect(recommendation.citations.length).toBeGreaterThan(0);
      expect(recommendation.citations[0]?.sourceRef).toBeTruthy();
    }
  });

  it("attaches demand evidence only to the interval it overlaps", () => {
    const morningDemand = buildCitation({
      kind: "booked_appointments",
      observedValue: 6,
      sourceRef: "appointments:2026-08-08-am",
      windowStart: "10:00",
      windowEnd: "12:00",
    });
    const result = recommendCoverage({
      plan,
      shifts: [],
      demandCitations: [morningDemand],
    });
    const morning = result.find((entry) => entry.startTime === "10:00");
    const afternoon = result.find(
      (entry) =>
        entry.startTime === "14:00" &&
        entry.kind === "headcount_below_requirement",
    );
    expect(
      morning?.citations.some((c) => c.kind === "booked_appointments"),
    ).toBe(true);
    expect(
      afternoon?.citations.some((c) => c.kind === "booked_appointments"),
    ).toBe(false);
  });

  it("flags a missing required skill even when headcount is satisfied", () => {
    const result = recommendCoverage({
      plan,
      shifts: [
        shift({ staffId: "a", sourceRef: "staff_shifts:a" }),
        shift({ staffId: "b", sourceRef: "staff_shifts:b" }),
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("missing_required_skill");
    expect(result[0]?.missingSkill).toBe("mtm_fitting");
  });

  it("does not count a shift that ends exactly when the interval starts", () => {
    // Half-open overlap. Counting this as coverage is how a roster ends up
    // with a hole nobody planned.
    const result = recommendCoverage({
      plan: {
        ...plan,
        intervals: [
          { startTime: "14:00", endTime: "18:00", requiredHeadcount: 1 },
        ],
      },
      shifts: [shift({ startTime: "10:00", endTime: "14:00" })],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.shortfall).toBe(1);
  });

  it("reports no surplus when more people are scheduled than required", () => {
    const result = recommendCoverage({
      plan: {
        ...plan,
        intervals: [
          { startTime: "10:00", endTime: "14:00", requiredHeadcount: 1 },
        ],
      },
      shifts: [
        shift({ staffId: "a", sourceRef: "staff_shifts:a" }),
        shift({ staffId: "b", sourceRef: "staff_shifts:b" }),
        shift({ staffId: "c", sourceRef: "staff_shifts:c" }),
      ],
    });
    expect(result).toEqual([]);
  });

  it("rejects a malformed wall-clock time rather than coercing it to zero", () => {
    expect(() =>
      recommendCoverage({
        plan: {
          ...plan,
          intervals: [
            { startTime: "not-a-time", endTime: "18:00", requiredHeadcount: 1 },
          ],
        },
        shifts: [shift({})],
      }),
    ).toThrow(/Invalid wall-clock time/);
  });
});

describe("checkSwapRequest", () => {
  const own = shift({ staffId: "staff-1" });

  it("accepts a swap of your own shift to an available peer", () => {
    expect(
      checkSwapRequest({
        shift: own,
        requestingStaffId: "staff-1",
        peerStaffId: "staff-2",
        peerDeclaredAvailable: true,
        peerExistingShifts: [],
      }),
    ).toEqual({ ok: true });
  });

  it("refuses to give away someone else's shift", () => {
    expect(
      checkSwapRequest({
        shift: own,
        requestingStaffId: "staff-9",
        peerStaffId: "staff-2",
        peerDeclaredAvailable: true,
        peerExistingShifts: [],
      }),
    ).toEqual({ ok: false, reason: "not_own_shift" });
  });

  it("refuses a peer who has not declared availability", () => {
    expect(
      checkSwapRequest({
        shift: own,
        requestingStaffId: "staff-1",
        peerStaffId: "staff-2",
        peerDeclaredAvailable: false,
        peerExistingShifts: [],
      }),
    ).toEqual({ ok: false, reason: "peer_unavailable" });
  });

  it("refuses a peer already working an overlapping shift", () => {
    expect(
      checkSwapRequest({
        shift: own,
        requestingStaffId: "staff-1",
        peerStaffId: "staff-2",
        peerDeclaredAvailable: true,
        peerExistingShifts: [
          shift({ staffId: "staff-2", startTime: "12:00", endTime: "16:00" }),
        ],
      }),
    ).toEqual({ ok: false, reason: "peer_already_scheduled" });
  });
});

describe("checkSwapApproval", () => {
  const base = {
    state: "accepted_by_peer" as const,
    approverStaffId: "manager-1",
    requestingStaffId: "staff-1",
    peerStaffId: "staff-2",
    requiredSkills: [] as readonly string[],
    peerSkills: [] as readonly string[],
    otherCoveringSkills: [] as readonly string[],
  };

  it("approves a clean swap", () => {
    expect(checkSwapApproval(base)).toEqual({ ok: true });
  });

  it("refuses approval before the peer has accepted", () => {
    expect(checkSwapApproval({ ...base, state: "requested" })).toEqual({
      ok: false,
      reason: "not_awaiting_approval",
    });
  });

  it("refuses a manager approving their own swap", () => {
    expect(checkSwapApproval({ ...base, approverStaffId: "staff-1" })).toEqual({
      ok: false,
      reason: "self_approval_not_allowed",
    });
  });

  it("refuses a manager approving a swap they are the peer on", () => {
    expect(checkSwapApproval({ ...base, approverStaffId: "staff-2" })).toEqual({
      ok: false,
      reason: "self_approval_not_allowed",
    });
  });

  it("refuses a swap that would remove the last person with a required skill", () => {
    expect(
      checkSwapApproval({
        ...base,
        requiredSkills: ["mtm_fitting"],
        peerSkills: [],
        otherCoveringSkills: [],
      }),
    ).toEqual({ ok: false, reason: "would_break_required_skill" });
  });

  it("allows the swap when someone else still covers the skill", () => {
    expect(
      checkSwapApproval({
        ...base,
        requiredSkills: ["mtm_fitting"],
        peerSkills: [],
        otherCoveringSkills: ["mtm_fitting"],
      }),
    ).toEqual({ ok: true });
  });
});
