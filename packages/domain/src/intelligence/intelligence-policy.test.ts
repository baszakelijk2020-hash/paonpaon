import { describe, expect, it } from "vitest";

import {
  correctionRequiresRecompute,
  DEFAULT_INTELLIGENCE_POLICY,
  evaluateIntelligenceEligibility,
  maskForbiddenFields,
} from "./intelligence-policy";

describe("intelligence policy eligibility", () => {
  it("keeps capability-first defaults draft-only for activation", () => {
    const decision = evaluateIntelligenceEligibility({
      policy: DEFAULT_INTELLIGENCE_POLICY,
      purpose: "activation",
      personalizationConsentGranted: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain("activation_disabled_draft_only");
  });

  it("fails closed for anonymous capture under default policy", () => {
    const decision = evaluateIntelligenceEligibility({
      policy: DEFAULT_INTELLIGENCE_POLICY,
      purpose: "capture",
      personalizationConsentGranted: false,
      isAnonymous: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain("anonymous_capture_disabled");
  });

  it("masks forbidden fields without jurisdiction branches", () => {
    expect(
      maskForbiddenFields(
        { productId: "x", password: "secret", color: "brown" },
        DEFAULT_INTELLIGENCE_POLICY.fieldMask,
      ),
    ).toEqual({ productId: "x", color: "brown" });
  });

  it("flags recompute after preference corrections", () => {
    const plan = correctionRequiresRecompute({
      correctedFactTypes: ["colour_interest"],
      affectedProjectorVersions: ["customer-interest-v1", "for-you-v1"],
    });
    expect(plan.recomputeInterest).toBe(true);
    expect(plan.recomputeForYou).toBe(true);
    expect(plan.expireOpportunities).toBe(true);
  });
});
