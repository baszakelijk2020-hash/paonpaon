/**
 * Private offers and seven-day wardrobe campaigns (CAMP-001, CAMP-002,
 * MR-003, MILE-002 / PHASE 5.1 / ADR-061).
 *
 * Audiences require personalization consent — marketing consent is never
 * reused. Rewards are restrained, capped, and auditable.
 */

import type { ConsentStatus } from "../intelligence/consent";
import type { LoyaltyTier } from "../loyalty/loyalty";
import type {
  CampaignDeliveryAuditId,
  CampaignEnrollmentId,
  CampaignId,
  CampaignRewardGrantId,
  CampaignTargetId,
  CustomerId,
  NotificationId,
  ProductId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";
import {
  isValidIanaTimezone,
  localDateInTimezone,
  localWeekdayInTimezone,
  matchesDeliveryFrequency,
} from "../wardrobe/morning-routine-delivery";
import { type OutfitSlotKind } from "../wardrobe/sartorial";

export const CAMPAIGN_KINDS = ["private_offer", "seven_day_wardrobe"] as const;

export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

export const CAMPAIGN_SCHEDULE_FREQUENCIES = ["daily", "weekly"] as const;

export type CampaignScheduleFrequency =
  (typeof CAMPAIGN_SCHEDULE_FREQUENCIES)[number];

export const CAMPAIGN_TARGET_TYPES = [
  "fabric_concept",
  "category_concept",
  "product",
  "collection",
] as const;

export type CampaignTargetType = (typeof CAMPAIGN_TARGET_TYPES)[number];

export const CAMPAIGN_REWARD_KINDS = [
  "tie",
  "shirt",
  "short_lived_offer",
] as const;

export type CampaignRewardKind = (typeof CAMPAIGN_REWARD_KINDS)[number];

export const CAMPAIGN_ENROLLMENT_STATUSES = [
  "in_progress",
  "completed",
  "expired",
] as const;

export type CampaignEnrollmentStatus =
  (typeof CAMPAIGN_ENROLLMENT_STATUSES)[number];

export const CAMPAIGN_REWARD_STATUSES = [
  "issued",
  "redeemed",
  "expired",
  "cancelled",
] as const;

export type CampaignRewardStatus = (typeof CAMPAIGN_REWARD_STATUSES)[number];

export const CAMPAIGN_DELIVERY_OUTCOMES = [
  "delivered",
  "suppressed",
  "skipped_not_in_audience",
  "skipped_withdrawn_consent",
  "skipped_schedule",
  "skipped_duplicate",
  "skipped_campaign_inactive",
  "skipped_retailer_paused",
  "failed",
] as const;

export type CampaignDeliveryOutcome =
  (typeof CAMPAIGN_DELIVERY_OUTCOMES)[number];

export const CAMPAIGN_SUPPRESSION_REASONS = [
  "personalization_withdrawn",
  "not_in_audience",
  "product_not_targeted",
  "duplicate_for_date",
  "campaign_inactive",
  "retailer_paused",
  "unrelated_promotion_blocked",
  "manual",
] as const;

export type CampaignSuppressionReason =
  (typeof CAMPAIGN_SUPPRESSION_REASONS)[number];

/** Minimum catalogue slots for a complete seven-day look. */
export const WARDROBE_CHALLENGE_REQUIRED_SLOTS: readonly OutfitSlotKind[] = [
  "jacket",
  "trousers",
  "shirt",
  "shoes",
];

export const WARDROBE_CHALLENGE_DAY_COUNT = 7;

export interface RetailerCampaign extends Timestamps {
  readonly id: CampaignId;
  readonly retailerId: RetailerId;
  readonly kind: CampaignKind;
  readonly title: string;
  readonly description?: string;
  readonly active: boolean;
  readonly paused: boolean;
  readonly scheduleFrequency: CampaignScheduleFrequency;
  readonly timezone: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly rewardKind?: CampaignRewardKind;
  readonly rewardCapPerCustomer: number;
  readonly rewardExpiresDays?: number;
  readonly requiresPersonalizationConsent: boolean;
  readonly minimumLoyaltyTier?: LoyaltyTier;
  readonly createdByStaffId?: StaffId;
}

export interface CampaignTarget {
  readonly id: CampaignTargetId;
  readonly campaignId: CampaignId;
  readonly retailerId: RetailerId;
  readonly targetType: CampaignTargetType;
  readonly targetId: string;
  readonly label: string;
  readonly createdAt: string;
}

export interface WardrobeChallengeEnrollment extends Timestamps {
  readonly id: CampaignEnrollmentId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly campaignId: CampaignId;
  readonly status: CampaignEnrollmentStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
}

export interface WardrobeChallengeDayLook {
  readonly id: string;
  readonly enrollmentId: CampaignEnrollmentId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly dayIndex: number;
  readonly slots: Readonly<Partial<Record<OutfitSlotKind, ProductId>>>;
  readonly savedAt: string;
}

export interface CampaignRewardGrant {
  readonly id: CampaignRewardGrantId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly campaignId: CampaignId;
  readonly enrollmentId?: CampaignEnrollmentId;
  readonly rewardKind: CampaignRewardKind;
  readonly status: CampaignRewardStatus;
  readonly code: string;
  readonly expiresAt?: string;
  readonly createdAt: string;
}

export interface CampaignDeliveryAudit {
  readonly id: CampaignDeliveryAuditId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly campaignId: CampaignId;
  readonly forDate: string;
  readonly outcome: CampaignDeliveryOutcome;
  readonly suppressionReason?: CampaignSuppressionReason;
  readonly notificationId?: NotificationId;
  readonly scheduledFor: string;
  readonly createdAt: string;
}

const LOYALTY_TIER_RANK: Record<LoyaltyTier, number> = {
  member: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
};

export function loyaltyTierMeetsMinimum(
  tier: LoyaltyTier,
  minimum?: LoyaltyTier,
): boolean {
  if (!minimum) return true;
  return LOYALTY_TIER_RANK[tier] >= LOYALTY_TIER_RANK[minimum];
}

export function isPersonalizationGranted(status: ConsentStatus): boolean {
  return status === "granted";
}

export function buildCampaignAudienceExplanation(args: {
  readonly requiresPersonalizationConsent: boolean;
  readonly personalizationStatus: ConsentStatus;
  readonly minimumLoyaltyTier?: LoyaltyTier;
  readonly customerTier?: LoyaltyTier;
  readonly targetLabels: readonly string[];
}): readonly string[] {
  const lines: string[] = [];
  if (args.requiresPersonalizationConsent) {
    lines.push(
      args.personalizationStatus === "granted"
        ? "Personalization consent is granted for this house."
        : "Personalization consent is required and not granted.",
    );
  }
  if (args.minimumLoyaltyTier) {
    lines.push(
      args.customerTier &&
        loyaltyTierMeetsMinimum(args.customerTier, args.minimumLoyaltyTier)
        ? `Membership tier meets ${args.minimumLoyaltyTier} or above.`
        : `Requires ${args.minimumLoyaltyTier} tier or above.`,
    );
  }
  if (args.targetLabels.length > 0) {
    lines.push(`Offer applies to: ${args.targetLabels.join(", ")}.`);
  }
  return lines;
}

export function evaluateCampaignAudience(args: {
  readonly campaign: Pick<
    RetailerCampaign,
    | "active"
    | "paused"
    | "requiresPersonalizationConsent"
    | "minimumLoyaltyTier"
    | "startsAt"
    | "endsAt"
  >;
  readonly personalizationStatus: ConsentStatus;
  readonly customerTier?: LoyaltyTier;
  readonly nowUtcIso: string;
}):
  | { readonly ok: true; readonly explanation: readonly string[] }
  | {
      readonly ok: false;
      readonly reason: CampaignSuppressionReason;
      readonly explanation: readonly string[];
    } {
  const explanation = buildCampaignAudienceExplanation({
    requiresPersonalizationConsent:
      args.campaign.requiresPersonalizationConsent,
    personalizationStatus: args.personalizationStatus,
    ...(args.campaign.minimumLoyaltyTier
      ? {
          minimumLoyaltyTier: args.campaign.minimumLoyaltyTier,
          customerTier: args.customerTier,
        }
      : {}),
    targetLabels: [],
  });

  if (!args.campaign.active || args.campaign.paused) {
    return {
      ok: false,
      reason: args.campaign.paused ? "retailer_paused" : "campaign_inactive",
      explanation,
    };
  }

  const now = new Date(args.nowUtcIso).getTime();
  if (
    args.campaign.startsAt &&
    new Date(args.campaign.startsAt).getTime() > now
  ) {
    return { ok: false, reason: "campaign_inactive", explanation };
  }
  if (args.campaign.endsAt && new Date(args.campaign.endsAt).getTime() < now) {
    return { ok: false, reason: "campaign_inactive", explanation };
  }

  if (
    args.campaign.requiresPersonalizationConsent &&
    !isPersonalizationGranted(args.personalizationStatus)
  ) {
    return {
      ok: false,
      reason: "personalization_withdrawn",
      explanation,
    };
  }

  if (
    args.campaign.minimumLoyaltyTier &&
    (!args.customerTier ||
      !loyaltyTierMeetsMinimum(
        args.customerTier,
        args.campaign.minimumLoyaltyTier,
      ))
  ) {
    return { ok: false, reason: "not_in_audience", explanation };
  }

  return { ok: true, explanation };
}

export function evaluateCampaignSchedule(args: {
  readonly scheduleFrequency: CampaignScheduleFrequency;
  readonly timezone: string;
  readonly nowUtcIso: string;
}): { readonly ok: boolean; readonly forDate: string } {
  const timezone = isValidIanaTimezone(args.timezone) ? args.timezone : "UTC";
  const forDate = localDateInTimezone(args.nowUtcIso, timezone);
  const weekday = localWeekdayInTimezone(args.nowUtcIso, timezone);
  const ok = matchesDeliveryFrequency({
    frequency: args.scheduleFrequency,
    forDate,
    weekday,
  });
  return { ok, forDate };
}

export function productMatchesCampaignTargets(args: {
  readonly productId: ProductId | string;
  readonly collectionIds: readonly string[];
  readonly conceptIds: readonly string[];
  readonly targets: readonly Pick<CampaignTarget, "targetType" | "targetId">[];
}): boolean {
  if (args.targets.length === 0) return true;
  for (const target of args.targets) {
    switch (target.targetType) {
      case "product":
        if (target.targetId === args.productId) return true;
        break;
      case "collection":
        if (args.collectionIds.includes(target.targetId)) return true;
        break;
      case "fabric_concept":
      case "category_concept":
        if (args.conceptIds.includes(target.targetId)) return true;
        break;
      default: {
        const _exhaustive: never = target.targetType;
        return _exhaustive;
      }
    }
  }
  return false;
}

export function isWardrobeChallengeDayComplete(
  slots: Readonly<Partial<Record<OutfitSlotKind, ProductId | string>>>,
): boolean {
  return WARDROBE_CHALLENGE_REQUIRED_SLOTS.every((slotKind) => {
    const value = slots[slotKind];
    return value !== undefined && value !== null && value !== "";
  });
}

export function isWardrobeChallengeComplete(
  dayLooks: readonly Pick<WardrobeChallengeDayLook, "dayIndex" | "slots">[],
): boolean {
  if (dayLooks.length < WARDROBE_CHALLENGE_DAY_COUNT) return false;
  const byDay = new Map(dayLooks.map((look) => [look.dayIndex, look] as const));
  for (let day = 1; day <= WARDROBE_CHALLENGE_DAY_COUNT; day += 1) {
    const look = byDay.get(day);
    if (!look || !isWardrobeChallengeDayComplete(look.slots)) return false;
  }
  return true;
}

export function evaluateChallengeRewardEligibility(args: {
  readonly campaign: Pick<
    RetailerCampaign,
    "rewardKind" | "rewardCapPerCustomer" | "rewardExpiresDays"
  >;
  readonly dayLooks: readonly Pick<
    WardrobeChallengeDayLook,
    "dayIndex" | "slots"
  >[];
  readonly existingGrantCount: number;
  readonly nowUtcIso: string;
}):
  | {
      readonly ok: true;
      readonly rewardKind: CampaignRewardKind;
      readonly expiresAt?: string;
    }
  | { readonly ok: false; readonly reason: string } {
  if (!args.campaign.rewardKind) {
    return { ok: false, reason: "Campaign has no configured reward." };
  }
  if (args.existingGrantCount >= args.campaign.rewardCapPerCustomer) {
    return { ok: false, reason: "Reward cap reached for this campaign." };
  }
  if (!isWardrobeChallengeComplete(args.dayLooks)) {
    return {
      ok: false,
      reason: "All seven complete catalogue looks are required.",
    };
  }

  let expiresAt: string | undefined;
  if (
    args.campaign.rewardKind === "short_lived_offer" &&
    args.campaign.rewardExpiresDays
  ) {
    const expires = new Date(args.nowUtcIso);
    expires.setUTCDate(expires.getUTCDate() + args.campaign.rewardExpiresDays);
    expiresAt = expires.toISOString();
  }

  return {
    ok: true,
    rewardKind: args.campaign.rewardKind,
    ...(expiresAt ? { expiresAt } : {}),
  };
}

export function evaluatePrivateOfferDelivery(args: {
  readonly campaign: Pick<
    RetailerCampaign,
    | "active"
    | "paused"
    | "scheduleFrequency"
    | "timezone"
    | "requiresPersonalizationConsent"
    | "minimumLoyaltyTier"
    | "startsAt"
    | "endsAt"
  >;
  readonly personalizationStatus: ConsentStatus;
  readonly customerTier?: LoyaltyTier;
  readonly nowUtcIso: string;
  readonly alreadyDeliveredForDate: boolean;
}):
  | { readonly ok: true; readonly forDate: string }
  | {
      readonly ok: false;
      readonly forDate: string;
      readonly outcome: CampaignDeliveryOutcome;
      readonly suppressionReason?: CampaignSuppressionReason;
    } {
  const audience = evaluateCampaignAudience({
    campaign: args.campaign,
    personalizationStatus: args.personalizationStatus,
    ...(args.customerTier ? { customerTier: args.customerTier } : {}),
    nowUtcIso: args.nowUtcIso,
  });
  const schedule = evaluateCampaignSchedule({
    scheduleFrequency: args.campaign.scheduleFrequency,
    timezone: args.campaign.timezone,
    nowUtcIso: args.nowUtcIso,
  });

  if (!audience.ok) {
    return {
      ok: false,
      forDate: schedule.forDate,
      outcome:
        audience.reason === "personalization_withdrawn"
          ? "skipped_withdrawn_consent"
          : "skipped_not_in_audience",
      suppressionReason: audience.reason,
    };
  }

  if (!schedule.ok) {
    return {
      ok: false,
      forDate: schedule.forDate,
      outcome: "skipped_schedule",
    };
  }

  if (args.alreadyDeliveredForDate) {
    return {
      ok: false,
      forDate: schedule.forDate,
      outcome: "skipped_duplicate",
      suppressionReason: "duplicate_for_date",
    };
  }

  return { ok: true, forDate: schedule.forDate };
}

export function buildPrivateOfferNotification(args: {
  readonly title: string;
  readonly forDate: string;
}): {
  readonly title: string;
  readonly body: string;
  readonly actionHref: string;
} {
  return {
    title: args.title,
    body: `A private offer is available for ${args.forDate}. Open your private offers area to review.`,
    actionHref: "/private-offers",
  };
}

export function wardrobeChallengeDayLabels(): readonly string[] {
  return ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];
}
