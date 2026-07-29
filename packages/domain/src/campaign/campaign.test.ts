import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  evaluateCampaignAudience,
  evaluateChallengeRewardEligibility,
  evaluatePrivateOfferDelivery,
  isWardrobeChallengeComplete,
  isWardrobeChallengeDayComplete,
  productMatchesCampaignTargets,
} from "./campaign";
import { upsertRetailerCampaignInputSchema } from "./campaign.schema";

const baseCampaign = {
  active: true,
  paused: false,
  requiresPersonalizationConsent: true,
  scheduleFrequency: "weekly" as const,
  timezone: "Europe/Amsterdam",
};

describe("campaign audience and schedule", () => {
  it("requires personalization consent and fails closed on withdrawal", () => {
    const denied = evaluateCampaignAudience({
      campaign: baseCampaign,
      personalizationStatus: "withdrawn",
      nowUtcIso: "2026-07-30T10:00:00.000Z",
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.reason).toBe("personalization_withdrawn");

    const granted = evaluateCampaignAudience({
      campaign: baseCampaign,
      personalizationStatus: "granted",
      nowUtcIso: "2026-07-30T10:00:00.000Z",
    });
    expect(granted.ok).toBe(true);
  });

  it("suppresses duplicate private-offer delivery for the same day", () => {
    const result = evaluatePrivateOfferDelivery({
      campaign: { ...baseCampaign, scheduleFrequency: "daily" },
      personalizationStatus: "granted",
      nowUtcIso: "2026-07-30T08:00:00.000Z",
      alreadyDeliveredForDate: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outcome).toBe("skipped_duplicate");
  });
});

describe("campaign product targeting", () => {
  it("matches product, collection, and concept targets", () => {
    expect(
      productMatchesCampaignTargets({
        productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        collectionIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"],
        conceptIds: ["cccccccc-cccc-4ccc-8ccc-ccccccccccc1"],
        targets: [
          {
            targetType: "product",
            targetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
          },
        ],
      }),
    ).toBe(true);
    expect(
      productMatchesCampaignTargets({
        productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        collectionIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"],
        conceptIds: [],
        targets: [
          {
            targetType: "collection",
            targetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          },
        ],
      }),
    ).toBe(true);
  });
});

describe("seven-day wardrobe challenge", () => {
  const completeSlots = {
    jacket: asId<"ProductId">("11111111-1111-4111-8111-111111111111"),
    trousers: asId<"ProductId">("22222222-2222-4222-8222-222222222222"),
    shirt: asId<"ProductId">("33333333-3333-4333-8333-333333333333"),
    shoes: asId<"ProductId">("44444444-4444-4444-8444-444444444444"),
  };

  it("requires core slots for each day", () => {
    expect(isWardrobeChallengeDayComplete(completeSlots)).toBe(true);
    expect(
      isWardrobeChallengeDayComplete({ jacket: completeSlots.jacket }),
    ).toBe(false);
  });

  it("grants reward only when all seven days are complete and under cap", () => {
    const dayLooks = Array.from({ length: 7 }, (_, index) => ({
      dayIndex: index + 1,
      slots: completeSlots,
    }));
    expect(isWardrobeChallengeComplete(dayLooks)).toBe(true);

    const eligible = evaluateChallengeRewardEligibility({
      campaign: {
        rewardKind: "tie",
        rewardCapPerCustomer: 1,
      },
      dayLooks,
      existingGrantCount: 0,
      nowUtcIso: "2026-07-30T10:00:00.000Z",
    });
    expect(eligible.ok).toBe(true);
    if (!eligible.ok) return;
    expect(eligible.rewardKind).toBe("tie");

    const capped = evaluateChallengeRewardEligibility({
      campaign: {
        rewardKind: "tie",
        rewardCapPerCustomer: 1,
      },
      dayLooks,
      existingGrantCount: 1,
      nowUtcIso: "2026-07-30T10:00:00.000Z",
    });
    expect(capped.ok).toBe(false);
  });
});

describe("campaign schema", () => {
  it("requires reward for seven-day wardrobe campaigns", () => {
    const parsed = upsertRetailerCampaignInputSchema.safeParse({
      kind: "seven_day_wardrobe",
      title: "Week of looks",
      timezone: "UTC",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts private offer campaigns without reward", () => {
    const parsed = upsertRetailerCampaignInputSchema.safeParse({
      kind: "private_offer",
      title: "Weekly wool",
      timezone: "UTC",
    });
    expect(parsed.success).toBe(true);
  });
});
