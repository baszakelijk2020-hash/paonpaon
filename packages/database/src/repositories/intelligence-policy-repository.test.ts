import {
  asId,
  buildDefaultPlatformPolicyConfig,
  evaluatePolicyEligibility,
} from "@paon/domain";
import { describe, expect, it } from "vitest";

describe("IntelligencePolicyRepository contract", () => {
  it("merges platform defaults when no retailer overrides exist", () => {
    const config = buildDefaultPlatformPolicyConfig({
      now: "2026-07-30T12:00:00.000Z",
    });
    expect(config.rules.length).toBeGreaterThan(0);
    const exportRule = evaluatePolicyEligibility({
      plane: "export",
      purpose: "personalization",
      config,
      consent: {
        retailerId: asId("11111111-1111-4111-8111-111111111111"),
        customerId: asId("33333333-3333-4333-8333-333333333333"),
        personalization: { purpose: "personalization", status: "granted" },
        marketing: { purpose: "marketing", status: "denied" },
        location: { purpose: "location", status: "denied" },
        updatedAt: "2026-07-30T12:00:00.000Z",
      },
    });
    expect(exportRule.decision).toBe("deny");
  });
});
