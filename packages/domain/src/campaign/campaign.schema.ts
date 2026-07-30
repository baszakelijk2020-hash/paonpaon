import { z } from "zod";

import { outfitSlotKindSchema } from "../wardrobe/roadmap.schema";
import { OUTFIT_SLOT_KINDS } from "../wardrobe/sartorial";

import {
  CAMPAIGN_AUDIENCE_RULE_KINDS,
  CAMPAIGN_KINDS,
  CAMPAIGN_REWARD_KINDS,
  CAMPAIGN_SCHEDULE_FREQUENCIES,
  CAMPAIGN_STATUSES,
  isValidCampaignDayIndex,
  isValidIanaTimezone,
} from "./campaign";

export const campaignKindSchema = z.enum(CAMPAIGN_KINDS);
export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES);
export const campaignScheduleFrequencySchema = z.enum(
  CAMPAIGN_SCHEDULE_FREQUENCIES,
);
export const campaignAudienceRuleKindSchema = z.enum(
  CAMPAIGN_AUDIENCE_RULE_KINDS,
);
export const campaignRewardKindSchema = z.enum(CAMPAIGN_REWARD_KINDS);

export const upsertCampaignInputSchema = z
  .object({
    campaignId: z.string().uuid().optional(),
    kind: campaignKindSchema,
    status: campaignStatusSchema.default("draft"),
    title: z.string().trim().min(1).max(120),
    summary: z.string().trim().min(1).max(500),
    explanation: z.string().trim().min(1).max(500),
    frequency: campaignScheduleFrequencySchema.default("weekly"),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine(isValidIanaTimezone, "timezone must be a valid IANA name"),
    preferredLocalHour: z.number().int().min(0).max(23).default(9),
    quietStartMinute: z.number().int().min(0).max(1439).optional(),
    quietEndMinute: z.number().int().min(0).max(1439).optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).optional(),
    rewardKind: campaignRewardKindSchema.optional(),
    rewardLabel: z.string().trim().min(1).max(120).optional(),
    rewardCapPerCustomer: z.number().int().min(1).max(3).default(1),
    shortLivedOfferHours: z.number().int().min(1).max(168).default(72),
  })
  .superRefine((value, ctx) => {
    const hasStart = value.quietStartMinute !== undefined;
    const hasEnd = value.quietEndMinute !== undefined;
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quiet hours require both start and end minutes.",
        path: ["quietStartMinute"],
      });
    }
    if (value.kind === "wardrobe_challenge" && !value.rewardKind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Wardrobe challenges require a restrained reward kind.",
        path: ["rewardKind"],
      });
    }
  });

export type UpsertCampaignInput = z.infer<typeof upsertCampaignInputSchema>;

export const upsertCampaignAudienceRuleInputSchema = z
  .object({
    campaignId: z.string().uuid(),
    ruleId: z.string().uuid().optional(),
    ruleKind: campaignAudienceRuleKindSchema,
    conceptId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    loyaltyTier: z.enum(["member", "silver", "gold", "platinum"]).optional(),
    requirePersonalizationConsent: z.boolean().default(true),
    explanation: z.string().trim().min(1).max(300),
    active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (
      (value.ruleKind === "fabric_concept" ||
        value.ruleKind === "category_concept" ||
        value.ruleKind === "style_preference") &&
      !value.conceptId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Concept-targeted rules require a conceptId.",
        path: ["conceptId"],
      });
    }
    if (value.ruleKind === "product" && !value.productId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Product rules require a productId.",
        path: ["productId"],
      });
    }
    if (value.ruleKind === "loyalty_tier" && !value.loyaltyTier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Loyalty tier rules require a tier.",
        path: ["loyaltyTier"],
      });
    }
  });

export type UpsertCampaignAudienceRuleInput = z.infer<
  typeof upsertCampaignAudienceRuleInputSchema
>;

export const setCampaignTargetProductInputSchema = z.object({
  campaignId: z.string().uuid(),
  productId: z.string().uuid(),
  active: z.boolean(),
});

export type SetCampaignTargetProductInput = z.infer<
  typeof setCampaignTargetProductInputSchema
>;

export const enrollCampaignChallengeInputSchema = z.object({
  campaignId: z.string().uuid(),
  retailerId: z.string().uuid(),
  customerId: z.string().uuid(),
});

export type EnrollCampaignChallengeInput = z.infer<
  typeof enrollCampaignChallengeInputSchema
>;

export const upsertCampaignChallengeLookInputSchema = z
  .object({
    enrollmentId: z.string().uuid(),
    dayIndex: z.number().int(),
    title: z.string().trim().min(1).max(120),
    occasionLabel: z.string().trim().min(1).max(80).optional(),
    gapCitations: z
      .array(
        z.object({
          slotKind: outfitSlotKindSchema,
          explanation: z.string().trim().min(1).max(500),
          factCitation: z.string().trim().min(1).max(500).optional(),
          ruleCitation: z.string().trim().min(1).max(500).optional(),
        }),
      )
      .optional(),
    slots: z
      .array(
        z
          .object({
            slotKind: outfitSlotKindSchema,
            sourceKind: z.enum(["owned", "catalogue_suggested"]).default(
              "catalogue_suggested",
            ),
            productId: z.string().uuid().optional(),
            wardrobeItemId: z.string().uuid().optional(),
          })
          .superRefine((slot, ctx) => {
            const hasProduct = Boolean(slot.productId);
            const hasWardrobe = Boolean(slot.wardrobeItemId);
            if (hasProduct === hasWardrobe) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                  "Each slot requires exactly one of productId or wardrobeItemId.",
              });
            }
            if (slot.sourceKind === "owned" && !slot.wardrobeItemId) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Owned slots require wardrobeItemId.",
                path: ["wardrobeItemId"],
              });
            }
          }),
      )
      .min(1)
      .max(OUTFIT_SLOT_KINDS.length),
  })
  .superRefine((value, ctx) => {
    if (!isValidCampaignDayIndex(value.dayIndex)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dayIndex must be between 1 and 7.",
        path: ["dayIndex"],
      });
    }
    const seen = new Set<string>();
    for (const slot of value.slots) {
      if (seen.has(slot.slotKind)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate slot ${slot.slotKind}.`,
          path: ["slots"],
        });
      }
      seen.add(slot.slotKind);
    }
  });

export type UpsertCampaignChallengeLookInput = z.infer<
  typeof upsertCampaignChallengeLookInputSchema
>;

export const completeCampaignChallengeInputSchema = z.object({
  enrollmentId: z.string().uuid(),
});

export type CompleteCampaignChallengeInput = z.infer<
  typeof completeCampaignChallengeInputSchema
>;
