import { describe, expect, it } from "vitest";

import {
  assessVirtualFit,
  checkComparison,
  checkObservationAdapter,
  checkSessionOutcome,
  checkVerticalPack,
  VERTICAL_SELECTION_NOTE,
  VIRTUAL_FIT_DISCLAIMER,
} from "./store-instrumentation";

describe("checkObservationAdapter", () => {
  const base = {
    kind: "anonymous_presence_count" as const,
    claimsBiometricIdentity: false,
    carriesStaffId: false,
    carriesCustomerId: false,
  };

  it("allows genuinely anonymous presence counting", () => {
    expect(checkObservationAdapter(base)).toEqual({ ok: true });
  });

  it("refuses biometric identity with no consent escape hatch", () => {
    // A consent checkbox on a shop door is not consent, so there is no
    // flag that enables this.
    expect(
      checkObservationAdapter({
        ...base,
        claimsBiometricIdentity: true,
        customerConsentRecorded: true,
      }),
    ).toEqual({ ok: false, reason: "biometric_identity_not_permitted" });
  });

  it("refuses any observation attributable to a staff member", () => {
    // A zone sensor that can report which advisor stood where becomes a
    // productivity monitor the day someone asks it to.
    expect(checkObservationAdapter({ ...base, carriesStaffId: true })).toEqual({
      ok: false,
      reason: "staff_attribution_not_permitted",
    });
  });

  it("allows a named customer observation only with recorded consent", () => {
    expect(
      checkObservationAdapter({ ...base, carriesCustomerId: true }),
    ).toEqual({ ok: false, reason: "customer_identity_requires_consent" });
    expect(
      checkObservationAdapter({
        ...base,
        carriesCustomerId: true,
        customerConsentRecorded: true,
      }),
    ).toEqual({ ok: true });
  });
});

describe("assessVirtualFit", () => {
  it("returns a band and a disclaimer, never a measurement", () => {
    // A mirror that says "42mm too long" implies an accuracy no display
    // has, and the customer will believe it.
    const result = assessVirtualFit({ observedDifferenceMillimetres: 42 });
    expect(result.band).toBe("noticeably_long");
    expect(result.disclaimer).toBe(VIRTUAL_FIT_DISCLAIMER);
    expect(Object.keys(result)).toEqual(["band", "disclaimer"]);
    expect(JSON.stringify(result)).not.toContain("42");
  });

  it("bands a small difference as as_expected rather than a false signal", () => {
    expect(assessVirtualFit({ observedDifferenceMillimetres: 3 }).band).toBe(
      "as_expected",
    );
    expect(assessVirtualFit({ observedDifferenceMillimetres: -3 }).band).toBe(
      "as_expected",
    );
  });

  it("bands both directions symmetrically", () => {
    expect(assessVirtualFit({ observedDifferenceMillimetres: -30 }).band).toBe(
      "noticeably_short",
    );
    expect(assessVirtualFit({ observedDifferenceMillimetres: -10 }).band).toBe(
      "slightly_short",
    );
  });
});

describe("checkSessionOutcome", () => {
  const base = {
    customerApprovedLookRef: "look-1",
    advisorStaffId: "staff-1",
    deviceFailed: false,
    manualFallbackUsed: false,
  };

  it("records an outcome against a look the customer approved", () => {
    expect(checkSessionOutcome(base)).toEqual({ ok: true });
  });

  it("refuses an outcome with no customer-approved look", () => {
    // Otherwise the store's own instrumentation becomes the record of what
    // the customer "wanted".
    const { customerApprovedLookRef: _drop, ...noLook } = base;
    expect(checkSessionOutcome(noLook)).toEqual({
      ok: false,
      reason: "no_customer_approved_look",
    });
  });

  it("treats a device failure with a manual fallback as a normal session", () => {
    // The acceptance criterion says device failure has a normal manual
    // fallback, so this is not an error state.
    expect(
      checkSessionOutcome({
        ...base,
        deviceFailed: true,
        manualFallbackUsed: true,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a failed device with no fallback recorded", () => {
    expect(checkSessionOutcome({ ...base, deviceFailed: true })).toEqual({
      ok: false,
      reason: "device_failure_needs_manual_fallback",
    });
  });
});

describe("checkComparison", () => {
  it("requires the reason, not just the preference", () => {
    // "Chose full canvas" is a sale. "Chose full canvas because the chest
    // felt softer" is something the next advisor can use.
    expect(
      checkComparison({
        records: [
          {
            constructionKind: "full_canvas",
            customerPreferred: true,
            notedReason: "Chest felt softer over the shoulder",
          },
        ],
      }),
    ).toEqual({ ok: true });
    expect(
      checkComparison({
        records: [
          {
            constructionKind: "full_canvas",
            customerPreferred: true,
            notedReason: "yes",
          },
        ],
      }),
    ).toEqual({ ok: false, reason: "reason_required" });
  });

  it("refuses a comparison where nothing was preferred", () => {
    expect(
      checkComparison({
        records: [
          {
            constructionKind: "half_canvas",
            customerPreferred: false,
            notedReason: "n/a",
          },
        ],
      }),
    ).toEqual({ ok: false, reason: "no_preference_recorded" });
  });
});

describe("checkVerticalPack", () => {
  const pack = {
    verticalKey: "eyewear",
    terminology: { garment: "frame" },
    formKeys: ["prescription_intake"],
    workflowKeys: ["lens_fitting"],
    sensitiveFieldKeys: ["prescription"],
  };

  it("accepts a pack that renames, adds forms and declares sensitive fields", () => {
    expect(
      checkVerticalPack({
        pack,
        coreEntityKeys: ["garment", "customer", "order"],
        declaredEntityKeys: ["frame_style"],
        declaredSensitiveFieldKeys: ["prescription"],
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a pack that forks a core entity", () => {
    // "No core fork" is the acceptance criterion, and this is what a fork
    // actually looks like.
    expect(
      checkVerticalPack({
        pack,
        coreEntityKeys: ["garment", "customer", "order"],
        declaredEntityKeys: ["customer"],
        declaredSensitiveFieldKeys: ["prescription"],
      }),
    ).toMatchObject({
      ok: false,
      reason: "forks_core_entity",
      detail: "customer",
    });
  });

  it("refuses renaming something the core does not have", () => {
    // A typo, not an override - and it would silently do nothing.
    expect(
      checkVerticalPack({
        pack: { ...pack, terminology: { garmnet: "frame" } },
        coreEntityKeys: ["garment"],
        declaredEntityKeys: [],
        declaredSensitiveFieldKeys: ["prescription"],
      }),
    ).toMatchObject({ ok: false, reason: "terminology_collides_with_core" });
  });

  it("refuses an undeclared sensitive field", () => {
    expect(
      checkVerticalPack({
        pack,
        coreEntityKeys: ["garment"],
        declaredEntityKeys: [],
        declaredSensitiveFieldKeys: [],
      }),
    ).toMatchObject({
      ok: false,
      reason: "sensitive_field_needs_declaration",
    });
  });

  it("states in code that the pilot vertical is evidence-selected", () => {
    expect(VERTICAL_SELECTION_NOTE).toContain("never");
    expect(VERTICAL_SELECTION_NOTE).toContain("prospect evidence");
  });
});
