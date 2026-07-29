import { z } from "zod";

import { LOYALTY_TIER_LABELS } from "../loyalty/loyalty";
import { isValidIanaTimezone } from "../wardrobe/morning-routine-delivery";
import { OUTFIT_SLOT_KINDS } from "../wardrobe/sartorial";

import {
  CAMPAIGN_KINDS,
  CAMPAIGN_REWARD_KINDS,
  CAMPAIGN_SCHEDULE_FREQUENCIES,
  CAMPAIGN_TARGET_TYPES,
  WARDROBE_CHALLENGE_DAY_COUNT,
} from "./campaign";

const loyaltyTierSchema = z.enum(
  Object.keys(LOYALTY_TIER_LABELS) as [
    keyof typeof LOYALTY_TIER_LABELS,
    ...Array<keyof typeof LOYALTY_TIER_LABELS>,
  ],
);

export const upsertRetailerCampaignInputSchema = z
  .object({
    campaignId: z.string().uuid().optional(),
    kind: z.enum(CAMPAIGN_KINDS),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional(),
    active: z.boolean().default(true),
    paused: z.boolean().default(false),
    scheduleFrequency: z.enum(CAMPAIGN_SCHEDULE_FREQUENCIES).default("weekly"),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine(isValidIanaTimezone, "timezone must be a valid IANA name"),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    rewardKind: z.enum(CAMPAIGN_REWARD_KINDS).optional(),
    rewardCapPerCustomer: z.number().int().min(1).max(3).default(1),
    rewardExpiresDays: z.number().int().min(1).max(30).optional(),
    requiresPersonalizationConsent: z.boolean().default(true),
    minimumLoyaltyTier: loyaltyTierSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "seven_day_wardrobe" && !value.rewardKind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Seven-day wardrobe campaigns require a reward kind.",
        path: ["rewardKind"],
      });
    }
    if (
      value.rewardKind === "short_lived_offer" &&
      value.rewardExpiresDays === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Short-lived offers require reward expiry days.",
        path: ["rewardExpiresDays"],
      });
    }
  });

export type UpsertRetailerCampaignInput = z.infer<
  typeof upsertRetailerCampaignInputSchema
>;

export const setCampaignTargetInputSchema = z.object({
  campaignId: z.string().uuid(),
  targetType: z.enum(CAMPAIGN_TARGET_TYPES),
  targetId: z.string().uuid(),
  label: z.string().trim().min(1).max(200),
  remove: z.boolean().optional(),
});

export type SetCampaignTargetInput = z.infer<
  typeof setCampaignTargetInputSchema
>;

export const startWardrobeChallengeInputSchema = z.object({
  retailerId: z.string().uuid(),
  customerId: z.string().uuid(),
  campaignId: z.string().uuid(),
});

export type StartWardrobeChallengeInput = z.infer<
  typeof startWardrobeChallengeInputSchema
>;

const dayLookSlotSchema = z
  .object(
    Object.fromEntries(
      OUTFIT_SLOT_KINDS.map((slot) => [slot, z.string().uuid().optional()]),
    ) as Record<(typeof OUTFIT_SLOT_KINDS)[number], z.ZodOptional<z.ZodString>>,
  )
  .partial();

export const saveWardrobeChallengeDayLookInputSchema = z.object({
  enrollmentId: z.string().uuid(),
  dayIndex: z.number().int().min(1).max(WARDROBE_CHALLENGE_DAY_COUNT),
  slots: dayLookSlotSchema,
});

export type SaveWardrobeChallengeDayLookInput = z.infer<
  typeof saveWardrobeChallengeDayLookInputSchema
>;

export const completeWardrobeChallengeInputSchema = z.object({
  enrollmentId: z.string().uuid(),
});

export type CompleteWardrobeChallengeInput = z.infer<
  typeof completeWardrobeChallengeInputSchema
>;
