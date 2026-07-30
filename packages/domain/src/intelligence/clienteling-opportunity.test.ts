import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  buildInterestFollowUpOpportunities,
  isContactPressureActive,
} from "./clienteling-opportunity";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const now = "2026-07-30T12:00:00.000Z";

describe("clienteling opportunities", () => {
  it("builds sparse draft follow-ups from cited interest statements", () => {
    const opportunities = buildInterestFollowUpOpportunities({
      retailerId,
      customerId,
      now,
      recentTouchCount: 0,
      insightStatements: [
        "8 of 10 suit views were brown",
        "6 of 8 jacket views were linen",
      ],
    });
    expect(opportunities).toHaveLength(2);
    expect(opportunities[0]).toMatchObject({
      type: "interest_follow_up",
      status: "draft",
      whyNow: "8 of 10 suit views were brown",
      contactPressure: false,
    });
  });

  it("emits a contact-pressure warning instead of a firehose", () => {
    expect(
      isContactPressureActive({
        recentTouchCount: 3,
        now,
      }),
    ).toBe(true);
    const opportunities = buildInterestFollowUpOpportunities({
      retailerId,
      customerId,
      now,
      recentTouchCount: 4,
      insightStatements: ["8 of 10 suit views were brown"],
    });
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.type).toBe("contact_pressure_warning");
    expect(opportunities[0]?.status).toBe("draft");
  });
});
