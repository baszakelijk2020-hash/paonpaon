import { describe, expect, it } from "vitest";

import {
  checkActivation,
  checkDelivery,
  checkIdentityClaim,
  checkRelease,
  planShareReversal,
  restateForecast,
  type ReleaseContext,
} from "./audience-governance";

function context(overrides: Partial<ReleaseContext> = {}): ReleaseContext {
  return {
    mode: "aggregate_insight",
    purpose: "Quarterly category benchmark for participating retailers",
    entitlementGranted: true,
    cohortSize: 400,
    ...overrides,
  };
}

describe("checkRelease", () => {
  it("allows a properly purposed, entitled aggregate", () => {
    expect(
      checkRelease({ context: context(), carriesNamedProfiles: false }),
    ).toEqual({ ok: true });
  });

  it("refuses a release with no stated purpose", () => {
    expect(
      checkRelease({
        context: context({ purpose: "  " }),
        carriesNamedProfiles: false,
      }),
    ).toEqual({ ok: false, reason: "purpose_required" });
  });

  it("refuses an aggregate below the minimum-n floor", () => {
    // Checked against the cohort as it is NOW: a cohort that was 400 and
    // is now 6 after a correction must stop being releasable immediately.
    expect(
      checkRelease({
        context: context({ cohortSize: 6 }),
        carriesNamedProfiles: false,
      }),
    ).toEqual({ ok: false, reason: "below_minimum_n" });
  });

  it("refuses a clean-room match with no contract", () => {
    expect(
      checkRelease({
        // No contractRef key at all: exactOptionalPropertyTypes means
        // "absent" and "explicitly undefined" are different things, and
        // the absent case is the one a caller actually hits.
        context: context({ mode: "clean_room_match" }),
        carriesNamedProfiles: false,
      }),
    ).toEqual({ ok: false, reason: "contract_required" });
  });

  it("refuses anything at all without an entitlement", () => {
    expect(
      checkRelease({
        context: context({ entitlementGranted: false }),
        carriesNamedProfiles: false,
      }),
    ).toEqual({ ok: false, reason: "entitlement_absent" });
  });

  it("refuses to export named profiles under a non-named mode", () => {
    // The core non-goal: no sale or export of named customer profiles for
    // uncontrolled reuse.
    expect(
      checkRelease({
        context: context({ mode: "contracted_exchange", contractRef: "c-1" }),
        carriesNamedProfiles: true,
      }),
    ).toEqual({ ok: false, reason: "mode_cannot_export_named_profiles" });
  });

  it("allows a named introduction only on the customer's own request", () => {
    expect(
      checkRelease({
        context: context({
          mode: "customer_requested_introduction",
          cohortSize: 1,
        }),
        carriesNamedProfiles: true,
      }),
    ).toEqual({
      ok: false,
      reason: "named_introduction_requires_customer_request",
    });
    expect(
      checkRelease({
        context: context({
          mode: "customer_requested_introduction",
          cohortSize: 1,
          customerRequestRef: "req-9",
        }),
        carriesNamedProfiles: true,
      }),
    ).toEqual({ ok: true });
  });

  it("lets a retailer export its own tenant data by name", () => {
    // It is their own data about their own customers.
    expect(
      checkRelease({
        context: context({ mode: "own_tenant_export", cohortSize: 3 }),
        carriesNamedProfiles: true,
      }),
    ).toEqual({ ok: true });
  });
});

describe("checkActivation", () => {
  const version = {
    cohortId: "c1",
    version: 4,
    ruleHash: "hash-a",
    sizeAtVersion: 900,
    computedAt: "2026-07-01T00:00:00.000Z",
  };

  it("pins the cohort version on activation", () => {
    expect(
      checkActivation({
        version,
        forecastRuleHash: "hash-a",
        entitlementGranted: true,
        liveServing: false,
      }),
    ).toEqual({ ok: true, pinnedVersion: 4 });
  });

  it("refuses when the rules changed since the forecast the buyer agreed to", () => {
    // Activating anyway sells them a number that no longer describes what
    // they are getting.
    expect(
      checkActivation({
        version,
        forecastRuleHash: "hash-old",
        entitlementGranted: true,
        liveServing: false,
      }),
    ).toEqual({ ok: false, reason: "rules_changed_since_forecast" });
  });

  it("refuses live serving with no contract", () => {
    expect(
      checkActivation({
        version,
        entitlementGranted: true,
        liveServing: true,
      }),
    ).toEqual({ ok: false, reason: "serving_not_contracted" });
  });

  it("refuses activation with no cohort version at all", () => {
    expect(
      checkActivation({ entitlementGranted: true, liveServing: false }),
    ).toEqual({ ok: false, reason: "no_cohort_version" });
  });
});

describe("restateForecast", () => {
  it("exists only to refuse", () => {
    // A past forecast is a historical claim. Recomputing it under today's
    // rules makes a measurement dispute unwinnable.
    const result = restateForecast();
    expect(result.supported).toBe(false);
    expect(result.reason).toContain("immutable");
  });
});

describe("checkDelivery", () => {
  const base = {
    pacing: {
      budgetMinorUnits: 100000,
      spentMinorUnits: 20000,
      deliveredImpressions: 4000,
      frequencyCap: 3,
      impressionsToThisRef: 1,
    },
    flightStart: "2026-07-01T00:00:00.000Z",
    flightEnd: "2026-08-31T00:00:00.000Z",
    asOf: "2026-08-01T00:00:00.000Z",
    creativeReviewed: true,
  };

  it("delivers inside budget, flight and cap", () => {
    expect(checkDelivery(base)).toEqual({ ok: true });
  });

  it("enforces the frequency cap rather than reporting it afterwards", () => {
    // A cap you can only observe after the fact is not a cap.
    expect(
      checkDelivery({
        ...base,
        pacing: { ...base.pacing, impressionsToThisRef: 3 },
      }),
    ).toEqual({ ok: false, reason: "frequency_cap_reached" });
  });

  it("stops on an exhausted budget", () => {
    expect(
      checkDelivery({
        ...base,
        pacing: { ...base.pacing, spentMinorUnits: 100000 },
      }),
    ).toEqual({ ok: false, reason: "budget_exhausted" });
  });

  it("refuses an unreviewed creative", () => {
    expect(checkDelivery({ ...base, creativeReviewed: false })).toEqual({
      ok: false,
      reason: "creative_not_reviewed",
    });
  });

  it("respects flight boundaries", () => {
    expect(
      checkDelivery({ ...base, asOf: "2026-06-01T00:00:00.000Z" }),
    ).toEqual({ ok: false, reason: "flight_not_started" });
    expect(
      checkDelivery({ ...base, asOf: "2026-09-30T00:00:00.000Z" }),
    ).toEqual({ ok: false, reason: "flight_ended" });
  });
});

describe("planShareReversal", () => {
  const shares = [
    { party: "retailer" as const, amountMinorUnits: 6000 },
    { party: "publisher" as const, amountMinorUnits: 2000 },
    { party: "paon_fee" as const, amountMinorUnits: 1000 },
  ];

  it("reverses every share on a full refund, not just the retailer's", () => {
    expect(planShareReversal({ shares, refundRatio: 1 })).toEqual([
      { party: "retailer", reversedMinorUnits: 6000 },
      { party: "publisher", reversedMinorUnits: 2000 },
      { party: "paon_fee", reversedMinorUnits: 1000 },
    ]);
  });

  it("apportions a partial refund across all parties", () => {
    expect(planShareReversal({ shares, refundRatio: 0.5 })).toEqual([
      { party: "retailer", reversedMinorUnits: 3000 },
      { party: "publisher", reversedMinorUnits: 1000 },
      { party: "paon_fee", reversedMinorUnits: 500 },
    ]);
  });

  it("clamps a nonsensical ratio instead of inventing money", () => {
    expect(planShareReversal({ shares, refundRatio: 5 })[0]).toEqual({
      party: "retailer",
      reversedMinorUnits: 6000,
    });
    expect(planShareReversal({ shares, refundRatio: -1 })).toEqual([]);
  });
});

describe("checkIdentityClaim", () => {
  it("allows a cross-device claim backed by a signed-in account", () => {
    expect(
      checkIdentityClaim({
        matchKind: "deterministic_account",
        claimsCrossDevice: true,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a cross-device claim resting on a probabilistic signal", () => {
    // A shared IP address is not evidence that two devices are one person.
    expect(
      checkIdentityClaim({
        matchKind: "probabilistic_signal",
        claimsCrossDevice: true,
      }),
    ).toEqual({ ok: false, reason: "cross_device_claim_unevidenced" });
  });

  it("does not object to a probabilistic signal that claims nothing", () => {
    expect(
      checkIdentityClaim({
        matchKind: "probabilistic_signal",
        claimsCrossDevice: false,
      }),
    ).toEqual({ ok: true });
  });
});
