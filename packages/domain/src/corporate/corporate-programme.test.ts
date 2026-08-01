import { describe, expect, it } from "vitest";

import {
  buildCorporateScopedView,
  checkAccommodationNote,
  checkIssue,
  computeEntitlementBalance,
  planLeaverExceptions,
  summarizeProgrammeReadiness,
  type EntitlementVersion,
} from "./corporate-programme";

const version: EntitlementVersion = {
  versionId: "ent-v2",
  version: 2,
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  rules: [
    {
      roleKey: "front_of_house",
      garmentKey: "jacket",
      quantity: 2,
      period: "annual",
    },
    {
      roleKey: "front_of_house",
      garmentKey: "shirt",
      quantity: 5,
      period: "annual",
    },
    { roleKey: "kitchen", garmentKey: "tunic", quantity: 4, period: "annual" },
  ],
};

describe("computeEntitlementBalance", () => {
  it("counts only issues inside the entitlement period", () => {
    const balances = computeEntitlementBalance({
      version,
      roleKey: "front_of_house",
      joinedOn: "2024-03-01T00:00:00.000Z",
      asOf: "2026-08-01T00:00:00.000Z",
      issues: [
        {
          garmentKey: "jacket",
          quantity: 1,
          issuedOn: "2026-02-01T00:00:00.000Z",
        },
        // Two years ago: outside the annual window, must not count against
        // this year's allowance.
        {
          garmentKey: "jacket",
          quantity: 2,
          issuedOn: "2024-06-01T00:00:00.000Z",
        },
      ],
    });
    const jacket = balances.find((b) => b.garmentKey === "jacket");
    expect(jacket).toEqual({
      garmentKey: "jacket",
      entitledQuantity: 2,
      issuedQuantity: 1,
      remainingQuantity: 1,
    });
  });

  it("returns nothing for a role the programme does not cover", () => {
    expect(
      computeEntitlementBalance({
        version,
        roleKey: "security",
        joinedOn: "2026-01-01T00:00:00.000Z",
        asOf: "2026-08-01T00:00:00.000Z",
        issues: [],
      }),
    ).toEqual([]);
  });

  it("never reports a negative remaining balance", () => {
    const balances = computeEntitlementBalance({
      version,
      roleKey: "kitchen",
      joinedOn: "2026-01-01T00:00:00.000Z",
      asOf: "2026-08-01T00:00:00.000Z",
      issues: [
        {
          garmentKey: "tunic",
          quantity: 9,
          issuedOn: "2026-03-01T00:00:00.000Z",
        },
      ],
    });
    expect(balances[0]?.remainingQuantity).toBe(0);
  });

  it("measures an on_joining entitlement from the join date", () => {
    const onJoining: EntitlementVersion = {
      ...version,
      rules: [
        {
          roleKey: "kitchen",
          garmentKey: "clogs",
          quantity: 1,
          period: "on_joining",
        },
      ],
    };
    const balances = computeEntitlementBalance({
      version: onJoining,
      roleKey: "kitchen",
      joinedOn: "2026-05-01T00:00:00.000Z",
      asOf: "2026-08-01T00:00:00.000Z",
      issues: [
        {
          garmentKey: "clogs",
          quantity: 1,
          issuedOn: "2026-05-02T00:00:00.000Z",
        },
      ],
    });
    expect(balances[0]?.remainingQuantity).toBe(0);
  });
});

describe("checkIssue", () => {
  const balances = [
    {
      garmentKey: "jacket",
      entitledQuantity: 2,
      issuedQuantity: 1,
      remainingQuantity: 1,
    },
  ];

  it("issues within the remaining allowance", () => {
    expect(
      checkIssue({
        balances,
        garmentKey: "jacket",
        quantity: 1,
        wearerActive: true,
        programmeActive: true,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses beyond the allowance and says what is left", () => {
    expect(
      checkIssue({
        balances,
        garmentKey: "jacket",
        quantity: 2,
        wearerActive: true,
        programmeActive: true,
      }),
    ).toEqual({ ok: false, reason: "entitlement_exhausted", remaining: 1 });
  });

  it("refuses a garment the role is not entitled to at all", () => {
    expect(
      checkIssue({
        balances,
        garmentKey: "tunic",
        quantity: 1,
        wearerActive: true,
        programmeActive: true,
      }),
    ).toEqual({ ok: false, reason: "not_entitled_to_garment" });
  });

  it("refuses for an inactive wearer or a suspended programme", () => {
    expect(
      checkIssue({
        balances,
        garmentKey: "jacket",
        quantity: 1,
        wearerActive: false,
        programmeActive: true,
      }),
    ).toEqual({ ok: false, reason: "wearer_not_active" });
    expect(
      checkIssue({
        balances,
        garmentKey: "jacket",
        quantity: 1,
        wearerActive: true,
        programmeActive: false,
      }),
    ).toEqual({ ok: false, reason: "programme_not_active" });
  });
});

describe("planLeaverExceptions", () => {
  it("produces garment returns and nothing resembling an HR record", () => {
    // PAON is not the employment record. The only fact needed is that a
    // wearer stopped being entitled.
    const exceptions = planLeaverExceptions({
      wearerId: "w1",
      issues: [
        {
          garmentKey: "jacket",
          quantity: 1,
          issuedOn: "2026-02-01T00:00:00.000Z",
        },
        {
          garmentKey: "jacket",
          quantity: 1,
          issuedOn: "2026-05-01T00:00:00.000Z",
        },
        {
          garmentKey: "shirt",
          quantity: 3,
          issuedOn: "2026-02-01T00:00:00.000Z",
        },
      ],
    });
    expect(exceptions).toEqual([
      {
        wearerId: "w1",
        garmentKey: "jacket",
        quantity: 2,
        action: "return_requested",
      },
      {
        wearerId: "w1",
        garmentKey: "shirt",
        quantity: 3,
        action: "return_requested",
      },
    ]);
    const serialized = JSON.stringify(exceptions);
    expect(serialized).not.toMatch(
      /termination|dismissal|resignation|notice_period|reason/i,
    );
  });

  it("marks agreed-retention garments instead of demanding them back", () => {
    const exceptions = planLeaverExceptions({
      wearerId: "w1",
      issues: [
        {
          garmentKey: "shirt",
          quantity: 3,
          issuedOn: "2026-02-01T00:00:00.000Z",
        },
      ],
      retainableGarmentKeys: ["shirt"],
    });
    expect(exceptions[0]?.action).toBe("retained_by_agreement");
  });
});

describe("summarizeProgrammeReadiness", () => {
  it("names who has not started rather than only a percentage", () => {
    // A percentage tells an account manager they are behind. A list tells
    // them who to call.
    const readiness = summarizeProgrammeReadiness({
      wearers: [
        { wearerId: "a", fitted: true, ordered: true, issued: true },
        { wearerId: "b", fitted: false, ordered: false, issued: false },
      ],
    });
    expect(readiness.notStartedWearerIds).toEqual(["b"]);
    expect(readiness.readyForTender).toBe(false);
  });

  it("is not tender-ready with no wearers at all", () => {
    expect(summarizeProgrammeReadiness({ wearers: [] }).readyForTender).toBe(
      false,
    );
  });

  it("is tender-ready once everyone is fitted", () => {
    expect(
      summarizeProgrammeReadiness({
        wearers: [
          { wearerId: "a", fitted: true, ordered: false, issued: false },
        ],
      }).readyForTender,
    ).toBe(true);
  });
});

describe("checkAccommodationNote", () => {
  it("accepts a garment adaptation stated as a garment fact", () => {
    expect(checkAccommodationNote("Left sleeve +40mm, magnetic cuff")).toEqual({
      ok: true,
    });
    expect(checkAccommodationNote("Seated cut, longer back rise")).toEqual({
      ok: true,
    });
  });

  it("refuses a note that reads like a diagnosis", () => {
    // A free-text field beside a fitting is exactly where health data ends
    // up by accident.
    for (const note of [
      "Wheelchair user, needs seated cut",
      "Post-surgery, avoid pressure on the shoulder",
      "Has a disability affecting grip",
    ]) {
      expect(checkAccommodationNote(note)).toEqual({
        ok: false,
        reason: "looks_like_health_data",
      });
    }
  });

  it("refuses an empty note", () => {
    expect(checkAccommodationNote("   ")).toEqual({
      ok: false,
      reason: "empty",
    });
  });
});

describe("buildCorporateScopedView", () => {
  it("gives the employer readiness and nothing about the retailer", () => {
    const readiness = summarizeProgrammeReadiness({
      wearers: [{ wearerId: "a", fitted: true, ordered: true, issued: false }],
    });
    const view = buildCorporateScopedView({ programmeId: "p1", readiness });
    expect(Object.keys(view)).toEqual([
      "programmeId",
      "wearerCount",
      "readiness",
    ]);
    // No margins, no other clients, and no individual measurements - a
    // supervisor reading a colleague's chest measurement is the worst
    // failure mode in this item.
    expect(JSON.stringify(view)).not.toMatch(
      /margin|cost|measurement|chest|waist/i,
    );
  });
});
