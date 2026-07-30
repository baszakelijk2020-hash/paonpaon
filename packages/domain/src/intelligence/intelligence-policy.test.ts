import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import type { CustomerConsentState } from "./consent";
import {
  buildDefaultPlatformPolicyConfig,
  evaluatePolicyEligibility,
  isPolicyAllowed,
} from "./intelligence-policy";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const now = "2026-07-30T12:00:00.000Z";

function consent(
  status: "granted" | "denied" | "withdrawn",
): CustomerConsentState {
  return {
    retailerId,
    customerId,
    personalization: { purpose: "personalization", status },
    marketing: { purpose: "marketing", status: "denied" },
    location: { purpose: "location", status: "denied" },
    updatedAt: now,
  };
}

describe("intelligence policy eligibility", () => {
  it("allows projection when consent and policy both allow", () => {
    const config = buildDefaultPlatformPolicyConfig({ now });
    const result = evaluatePolicyEligibility({
      plane: "projection",
      purpose: "personalization",
      config,
      consent: consent("granted"),
    });
    expect(isPolicyAllowed(result)).toBe(true);
  });

  it("denies capture when personalization is withdrawn even if rule allows", () => {
    const config = buildDefaultPlatformPolicyConfig({ now });
    const result = evaluatePolicyEligibility({
      plane: "capture",
      purpose: "personalization",
      config,
      consent: consent("withdrawn"),
    });
    expect(result.decision).toBe("deny");
    expect(result.reason).toContain("withdrawn");
  });

  it("defers location capture by default", () => {
    const config = buildDefaultPlatformPolicyConfig({ now });
    const result = evaluatePolicyEligibility({
      plane: "capture",
      purpose: "location",
      config,
      consent: consent("granted"),
    });
    expect(result.decision).toBe("defer");
  });

  it("denies export of personalization signals by default", () => {
    const config = buildDefaultPlatformPolicyConfig({ now });
    const result = evaluatePolicyEligibility({
      plane: "export",
      purpose: "personalization",
      config,
      consent: consent("granted"),
    });
    expect(result.decision).toBe("deny");
  });
});
