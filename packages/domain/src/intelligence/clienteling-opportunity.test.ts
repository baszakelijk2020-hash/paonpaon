import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  buildCampaignMissionOpportunity,
  buildInterestFollowUpOpportunities,
  evaluateCampaignRehearsal,
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

describe("evaluateCampaignRehearsal", () => {
  const customerA = asId<"CustomerId">("aaaaaaaa-0000-4000-8000-000000000001");
  const customerB = asId<"CustomerId">("bbbbbbbb-0000-4000-8000-000000000002");
  const customerC = asId<"CustomerId">("cccccccc-0000-4000-8000-000000000003");

  it("buckets every candidate into exactly one of eligible/excluded/contact_pressure", () => {
    const report = evaluateCampaignRehearsal({
      now,
      candidates: [
        {
          customerId: customerA,
          audienceMatch: { ok: true },
          recentTouchCount: 0,
        },
        {
          customerId: customerB,
          audienceMatch: { ok: false, reason: "loyalty tier too low" },
          recentTouchCount: 0,
        },
        {
          customerId: customerC,
          audienceMatch: { ok: true },
          recentTouchCount: 5,
        },
      ],
    });

    expect(report.eligibleCount).toBe(1);
    expect(report.excludedCount).toBe(1);
    expect(report.contactPressureCount).toBe(1);
    expect(report.outcomes).toEqual([
      { customerId: customerA, result: "eligible" },
      {
        customerId: customerB,
        result: "excluded",
        reason: "loyalty tier too low",
      },
      { customerId: customerC, result: "contact_pressure" },
    ]);
  });

  it("checks contact pressure only for audience-eligible customers, not excluded ones", () => {
    // A customer excluded by audience rules stays excluded even if they'd
    // also be under contact pressure — the two checks must not silently
    // merge into one ambiguous rejection reason.
    const report = evaluateCampaignRehearsal({
      now,
      candidates: [
        {
          customerId: customerA,
          audienceMatch: { ok: false, reason: "no personalization consent" },
          recentTouchCount: 10,
        },
      ],
    });
    expect(report.outcomes[0]).toEqual({
      customerId: customerA,
      result: "excluded",
      reason: "no personalization consent",
    });
  });

  it("returns an empty report for zero candidates rather than throwing", () => {
    const report = evaluateCampaignRehearsal({ now, candidates: [] });
    expect(report).toEqual({
      eligibleCount: 0,
      excludedCount: 0,
      contactPressureCount: 0,
      outcomes: [],
    });
  });
});

describe("buildCampaignMissionOpportunity", () => {
  it("gives every eligible customer the identical staff mission text", () => {
    const mission = buildCampaignMissionOpportunity({
      retailerId,
      customerId,
      campaignId: "campaign-1",
      campaignTitle: "Member Fabric Preview",
      staffMission: "Invite to preview the new fabric collection in-store.",
      now,
    });
    expect(mission.type).toBe("campaign_mission");
    expect(mission.campaignId).toBe("campaign-1");
    expect(mission.suggestedAction).toBe(
      "Invite to preview the new fabric collection in-store.",
    );
    expect(mission.status).toBe("draft");
    expect(mission.contactPressure).toBe(false);
  });
});
