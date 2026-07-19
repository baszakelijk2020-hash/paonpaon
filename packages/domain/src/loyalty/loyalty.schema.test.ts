import { describe, expect, it } from "vitest";

import {
  loyaltyProgramSchema,
  referralInviteSchema,
  rewardSchema,
} from "./loyalty.schema";

describe("loyalty schemas", () => {
  it("coerces programme settings from form values", () => {
    const value = loyaltyProgramSchema.parse({
      name: "Circle",
      enabled: true,
      pointsPerCurrencyUnit: "2",
      referralPoints: "500",
    });
    expect(value.pointsPerCurrencyUnit).toBe(2);
  });
  it("rejects rewards without a positive points cost", () => {
    expect(
      rewardSchema.safeParse({ name: "Gift", type: "gift", pointsCost: 0 })
        .success,
    ).toBe(false);
  });
  it("requires a valid referral email", () => {
    expect(
      referralInviteSchema.safeParse({
        retailerId: "11111111-1111-1111-1111-111111111111",
        referredEmail: "not-email",
      }).success,
    ).toBe(false);
  });
});
