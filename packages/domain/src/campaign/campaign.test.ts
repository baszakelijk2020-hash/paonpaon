import { describe, expect, it } from "vitest";

import type { MetadataConceptId } from "../shared/branded-id";

import {
  challengeCompleteness,
  evaluateAudienceRules,
  evaluateCampaignDelivery,
  evaluateCampaignSchedule,
  isLookComplete,
  resolveChallengeReward,
} from "./campaign";
import {
  enrollCampaignChallengeInputSchema,
  upsertCampaignChallengeLookInputSchema,
  upsertCampaignInputSchema,
} from "./campaign.schema";

const baseCampaign = {
  status: "active" as const,
  frequency: "daily" as const,
  timezone: "Europe/Amsterdam",
  preferredLocalHour: 8,
  explanation: "Weekly private fabric release for consented members.",
};

describe("campaign audience and schedule", () => {
  it("fails closed without personalization consent", () => {
    const result = evaluateAudienceRules({
      rules: [
        {
          ruleKind: "personalization_consent",
          requirePersonalizationConsent: true,
          active: true,
          explanation: "Requires personalization consent.",
        },
      ],
      personalizationConsent: "denied",
      customerConceptIds: new Set(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no_personalization_consent");
  });

  it("never treats marketing consent as audience membership", () => {
    const schema = upsertCampaignInputSchema.parse({
      kind: "private_offer",
      title: "Summer linen",
      summary: "A quiet linen drop.",
      explanation: "Shown to consented members interested in linen.",
      timezone: "UTC",
    });
    expect(schema.kind).toBe("private_offer");
    expect(JSON.stringify(schema)).not.toContain("marketing");
  });

  it("matches fabric concept when consented", () => {
    const conceptId =
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" as MetadataConceptId;
    const result = evaluateAudienceRules({
      rules: [
        {
          ruleKind: "fabric_concept",
          conceptId,
          requirePersonalizationConsent: true,
          active: true,
          explanation: "Shown because you prefer linen.",
        },
      ],
      personalizationConsent: "granted",
      customerConceptIds: new Set([conceptId]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matchedExplanations[0]).toContain("linen");
  });

  it("respects timezone schedule and quiet hours", () => {
    const quiet = evaluateCampaignSchedule({
      campaign: {
        ...baseCampaign,
        quietHours: { startMinute: 0, endMinute: 23 * 60 + 59 },
        preferredLocalHour: 0,
      },
      nowUtcIso: "2026-07-30T10:00:00.000Z",
      alreadyDeliveredForDate: false,
    });
    expect(quiet.ok).toBe(false);
    if (!quiet.ok) expect(quiet.outcome).toBe("skipped_quiet_hours");

    const ok = evaluateCampaignSchedule({
      campaign: baseCampaign,
      nowUtcIso: "2026-07-30T08:00:00.000Z",
      alreadyDeliveredForDate: false,
    });
    expect(ok.ok).toBe(true);
  });

  it("suppresses withdrawn consent on delivery", () => {
    const result = evaluateCampaignDelivery({
      campaign: baseCampaign,
      rules: [],
      personalizationConsent: "withdrawn",
      customerConceptIds: new Set(),
      nowUtcIso: "2026-07-30T08:00:00.000Z",
      alreadyDeliveredForDate: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outcome).toBe("skipped_consent_withdrawn");
  });
});

describe("seven-day challenge completeness and rewards", () => {
  const completeSlots = [
    { slotKind: "jacket" as const, productId: "p1" },
    { slotKind: "trousers" as const, productId: "p2" },
    { slotKind: "shirt" as const, productId: "p3" },
    { slotKind: "shoes" as const, productId: "p4" },
  ];

  it("requires core catalogue slots for a complete look", () => {
    expect(isLookComplete({ slots: completeSlots })).toBe(true);
    expect(
      isLookComplete({
        slots: completeSlots.filter((slot) => slot.slotKind !== "shoes"),
      }),
    ).toBe(false);
  });

  it("requires seven complete days", () => {
    const looks = Array.from({ length: 7 }, (_, index) => ({
      dayIndex: index + 1,
      slots: completeSlots,
    }));
    expect(challengeCompleteness({ looks }).isComplete).toBe(true);
    expect(
      challengeCompleteness({ looks: looks.slice(0, 6) }).missingDayIndexes,
    ).toEqual([7]);
  });

  it("grants restrained rewards idempotently with a hard cap", () => {
    const completeness = challengeCompleteness({
      looks: Array.from({ length: 7 }, (_, index) => ({
        dayIndex: index + 1,
        slots: completeSlots,
      })),
    });

    const first = resolveChallengeReward({
      campaign: {
        rewardKind: "personalized_tie",
        rewardLabel: "A personalised silk tie",
        rewardCapPerCustomer: 1,
        shortLivedOfferHours: 72,
      },
      existingGrantCount: 0,
      alreadyCompleted: false,
      completeness,
      nowUtcIso: "2026-07-30T10:00:00.000Z",
    });
    expect(first.ok).toBe(true);

    const capped = resolveChallengeReward({
      campaign: {
        rewardKind: "personalized_tie",
        rewardCapPerCustomer: 1,
        shortLivedOfferHours: 72,
      },
      existingGrantCount: 1,
      alreadyCompleted: false,
      completeness,
      nowUtcIso: "2026-07-30T10:00:00.000Z",
    });
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.reason).toBe("reward_cap");

    const replay = resolveChallengeReward({
      campaign: {
        rewardKind: "short_lived_offer",
        rewardCapPerCustomer: 1,
        shortLivedOfferHours: 48,
      },
      existingGrantCount: 0,
      alreadyCompleted: true,
      completeness,
      nowUtcIso: "2026-07-30T10:00:00.000Z",
    });
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.reason).toBe("already_completed");
  });

  it("validates enrollment and look inputs", () => {
    expect(() =>
      enrollCampaignChallengeInputSchema.parse({
        campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        retailerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        customerId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      }),
    ).not.toThrow();

    expect(() =>
      upsertCampaignChallengeLookInputSchema.parse({
        enrollmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        dayIndex: 8,
        title: "Monday",
        slots: [
          {
            slotKind: "jacket",
            productId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
          },
        ],
      }),
    ).toThrow();
  });
});
