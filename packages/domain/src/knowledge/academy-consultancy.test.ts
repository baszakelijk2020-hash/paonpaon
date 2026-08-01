import { describe, expect, it } from "vitest";

import {
  checkMediaActivation,
  checkProjectTransition,
  checkPublication,
  checkRoleplayGrade,
  checkTierCoherence,
  evaluateProductHypothesis,
} from "./academy-consultancy";

describe("checkPublication", () => {
  const base = {
    provenance: "human_authored" as const,
    reviewState: "human_approved" as const,
    authorStaffId: "a",
    reviewerStaffId: "b",
  };

  it("publishes approved human work reviewed by someone else", () => {
    expect(checkPublication(base)).toEqual({ ok: true });
  });

  it("refuses unreviewed AI content", () => {
    expect(
      checkPublication({
        ...base,
        provenance: "ai_generated",
        reviewState: "draft",
      }),
    ).toEqual({ ok: false, reason: "ai_content_requires_human_approval" });
  });

  it("treats ai_assisted exactly like ai_generated", () => {
    // A human who edited a machine draft is still publishing a machine
    // draft, and the distinction is too easy to claim to be worth trusting.
    expect(
      checkPublication({
        ...base,
        provenance: "ai_assisted",
        reviewState: "in_review",
      }),
    ).toEqual({ ok: false, reason: "ai_content_requires_human_approval" });
  });

  it("refuses licensed content with no licence reference", () => {
    expect(
      checkPublication({ ...base, provenance: "licensed_third_party" }),
    ).toEqual({ ok: false, reason: "licensed_content_requires_licence_ref" });
  });

  it("refuses an author reviewing their own work", () => {
    expect(checkPublication({ ...base, reviewerStaffId: "a" })).toEqual({
      ok: false,
      reason: "reviewer_cannot_be_author",
    });
  });
});

describe("checkTierCoherence", () => {
  const known = ["fitting", "pressing", "storage"];

  it("accepts nested tiers", () => {
    expect(
      checkTierCoherence({
        knownPackageKeys: known,
        tiers: [
          {
            tierKey: "base",
            includedPackageKeys: ["fitting"],
            priceMinorUnits: 10000,
          },
          {
            tierKey: "plus",
            includedPackageKeys: ["fitting", "pressing"],
            priceMinorUnits: 20000,
          },
        ],
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a dearer tier that drops something a cheaper one had", () => {
    // A customer who upgrades and loses a service will not read the small
    // print first; they will simply be angry, correctly.
    const result = checkTierCoherence({
      knownPackageKeys: known,
      tiers: [
        {
          tierKey: "base",
          includedPackageKeys: ["fitting", "pressing"],
          priceMinorUnits: 10000,
        },
        {
          tierKey: "plus",
          includedPackageKeys: ["fitting"],
          priceMinorUnits: 20000,
        },
      ],
    });
    expect(result).toMatchObject({
      ok: false,
      reason: "higher_tier_omits_lower_tier_package",
    });
  });

  it("refuses two tiers at the same price", () => {
    expect(
      checkTierCoherence({
        knownPackageKeys: known,
        tiers: [
          {
            tierKey: "a",
            includedPackageKeys: ["fitting"],
            priceMinorUnits: 10000,
          },
          {
            tierKey: "b",
            includedPackageKeys: ["fitting"],
            priceMinorUnits: 10000,
          },
        ],
      }),
    ).toMatchObject({ ok: false, reason: "higher_tier_not_more_expensive" });
  });

  it("refuses a tier referencing a package that does not exist", () => {
    expect(
      checkTierCoherence({
        knownPackageKeys: known,
        tiers: [
          {
            tierKey: "a",
            includedPackageKeys: ["butler"],
            priceMinorUnits: 10000,
          },
        ],
      }),
    ).toMatchObject({ ok: false, reason: "tier_includes_unknown_package" });
  });
});

describe("checkRoleplayGrade", () => {
  it("requires cited, observed behaviour", () => {
    // "Be more consultative" teaches nothing and cannot be disputed, which
    // are the same problem from two sides.
    expect(
      checkRoleplayGrade({
        evidence: [
          {
            criterionKey: "discovery",
            evidenceRef: "recording-12@04:11",
            observedBehaviour: "Asked about the occasion before the budget.",
          },
        ],
      }),
    ).toEqual({ ok: true });
    expect(
      checkRoleplayGrade({
        evidence: [
          {
            criterionKey: "discovery",
            evidenceRef: "r",
            observedBehaviour: "good",
          },
        ],
      }),
    ).toEqual({ ok: false, reason: "grade_without_evidence" });
  });

  it("refuses an empty rubric", () => {
    expect(checkRoleplayGrade({ evidence: [] })).toEqual({
      ok: false,
      reason: "no_criteria",
    });
  });
});

describe("checkProjectTransition", () => {
  const base = {
    deliverableCount: 2,
    retailerVisibleDeliverableCount: 1,
  };

  it("walks the normal path", () => {
    expect(
      checkProjectTransition({ ...base, from: "requested", to: "scoped" }),
    ).toEqual({ ok: true });
    expect(
      checkProjectTransition({ ...base, from: "scoped", to: "in_delivery" }),
    ).toEqual({ ok: true });
  });

  it("refuses delivery with nothing the retailer can see", () => {
    // Consultancy whose output is invisible to the client is consultancy
    // nobody can evaluate.
    expect(
      checkProjectTransition({
        ...base,
        from: "in_delivery",
        to: "delivered",
        retailerVisibleDeliverableCount: 0,
      }),
    ).toEqual({
      ok: false,
      reason: "delivery_requires_retailer_visible_deliverable",
    });
  });

  it("refuses to close without the retailer's approval", () => {
    expect(
      checkProjectTransition({ ...base, from: "delivered", to: "closed" }),
    ).toEqual({ ok: false, reason: "close_requires_approval" });
    expect(
      checkProjectTransition({
        ...base,
        from: "delivered",
        to: "closed",
        retailerApproved: true,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses to scope into delivery with no deliverables", () => {
    expect(
      checkProjectTransition({
        ...base,
        from: "scoped",
        to: "in_delivery",
        deliverableCount: 0,
      }),
    ).toEqual({ ok: false, reason: "scope_requires_deliverables" });
  });
});

describe("checkMediaActivation", () => {
  const base = {
    provenance: "licensed_third_party" as const,
    reviewState: "human_approved" as const,
    licenceRef: "lic-1",
    retailerTerritory: "NL",
    asOf: "2026-08-01T00:00:00.000Z",
  };

  it("activates in-territory, in-date, licensed content", () => {
    expect(
      checkMediaActivation({ ...base, territories: ["NL", "BE"] }),
    ).toEqual({ ok: true });
  });

  it("refuses content whose rights have expired", () => {
    expect(
      checkMediaActivation({ ...base, rightsExpireOn: "2026-07-01" }),
    ).toEqual({ ok: false, reason: "rights_expired" });
  });

  it("refuses content licensed for another territory", () => {
    expect(checkMediaActivation({ ...base, territories: ["FR"] })).toEqual({
      ok: false,
      reason: "territory_not_covered",
    });
  });

  it("refuses licensed content with no licence named", () => {
    // "We found it online" is how a publisher complaint starts.
    const { licenceRef: _drop, ...noLicence } = base;
    expect(checkMediaActivation(noLicence)).toEqual({
      ok: false,
      reason: "licence_required",
    });
  });
});

describe("evaluateProductHypothesis", () => {
  it("stays a hypothesis until all four evidence kinds exist", () => {
    const partial = evaluateProductHypothesis({
      evidenceKinds: ["demand", "margin"],
    });
    expect(partial.state).toBe("hypothesis");
    expect(partial.missingEvidenceKinds).toEqual(["supplier", "quality"]);
  });

  it("never authorises a purchase, even when fully evidenced", () => {
    // The non-goal is "no speculative stock purchase". The honest way to
    // honour it is for this function to have no success case that means
    // "buy it".
    const full = evaluateProductHypothesis({
      evidenceKinds: ["demand", "margin", "supplier", "quality"],
    });
    expect(full.state).toBe("evidenced");
    expect(full.authorisesPurchase).toBe(false);
  });
});
