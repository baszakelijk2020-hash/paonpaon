/**
 * Private offers and seven-day wardrobe campaigns
 * (CAMP-001, CAMP-002, MR-003, MILE-002 / PHASE 5.1 / ADR-061).
 *
 * Audiences are consent-aware and explainable. Marketing consent is never
 * reused for personalization targeting. Completion rewards are deterministic,
 * capped, and never chance-based.
 */

import type { ConsentStatus } from "../intelligence/consent";
import type {
  CampaignAudienceRuleId,
  CampaignChallengeEnrollmentId,
  CampaignChallengeLookId,
  CampaignChallengeLookSlotId,
  CampaignCompletionId,
  CampaignDeliveryAuditId,
  CampaignId,
  CampaignRewardGrantId,
  CustomerId,
  LoyaltyLedgerEntryId,
  MetadataConceptId,
  NotificationId,
  ProductId,
  RetailerId,
  StaffId,
  WardrobeItemId,
} from "../shared/branded-id";
import {
  isValidIanaTimezone,
  localDateInTimezone,
  localMinutesInTimezone,
  localWeekdayInTimezone,
  matchesDeliveryFrequency,
  isInQuietHours,
  type MorningRoutineDeliveryFrequency,
  type MorningRoutineQuietHours,
} from "../wardrobe/morning-routine-delivery";
import { OUTFIT_SLOT_KINDS, type OutfitSlotKind } from "../wardrobe/sartorial";

export {
  isValidIanaTimezone,
  localDateInTimezone,
  localMinutesInTimezone,
  localWeekdayInTimezone,
  matchesDeliveryFrequency,
  isInQuietHours,
};

export const CAMPAIGN_KINDS = [
  "private_offer",
  "wardrobe_challenge",
  "order_journey",
] as const;

export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

export const CAMPAIGN_STATUSES = [
  "draft",
  "active",
  "paused",
  "ended",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_SCHEDULE_FREQUENCIES = [
  "daily",
  "weekdays",
  "weekly",
] as const;

export type CampaignScheduleFrequency =
  (typeof CAMPAIGN_SCHEDULE_FREQUENCIES)[number];

export const CAMPAIGN_AUDIENCE_RULE_KINDS = [
  "personalization_consent",
  "fabric_concept",
  "category_concept",
  "product",
  "loyalty_tier",
  "style_preference",
] as const;

export type CampaignAudienceRuleKind =
  (typeof CAMPAIGN_AUDIENCE_RULE_KINDS)[number];

export const CAMPAIGN_REWARD_KINDS = [
  "personalized_tie",
  "personalized_shirt",
  "short_lived_offer",
] as const;

export type CampaignRewardKind = (typeof CAMPAIGN_REWARD_KINDS)[number];

export const CAMPAIGN_ENROLLMENT_STATUSES = [
  "in_progress",
  "completed",
  "withdrawn",
] as const;

export type CampaignEnrollmentStatus =
  (typeof CAMPAIGN_ENROLLMENT_STATUSES)[number];

export const CAMPAIGN_DELIVERY_OUTCOMES = [
  "queued_in_app",
  "queued_email",
  "suppressed",
  "skipped_schedule",
  "skipped_audience",
  "skipped_quiet_hours",
  "skipped_duplicate",
  "skipped_campaign_inactive",
  "skipped_consent_withdrawn",
  "failed",
] as const;

export type CampaignDeliveryOutcome =
  (typeof CAMPAIGN_DELIVERY_OUTCOMES)[number];

export const CAMPAIGN_SUPPRESSION_REASONS = [
  "no_personalization_consent",
  "audience_mismatch",
  "schedule_outside_window",
  "duplicate_for_date",
  "campaign_paused",
  "campaign_ended",
  "customer_withdrawn",
  "product_not_eligible",
  "manual",
] as const;

export type CampaignSuppressionReason =
  (typeof CAMPAIGN_SUPPRESSION_REASONS)[number];

/** Core slots required for a complete seven-day catalogue look. */
export const CAMPAIGN_REQUIRED_LOOK_SLOTS = [
  "jacket",
  "trousers",
  "shirt",
  "shoes",
] as const satisfies readonly OutfitSlotKind[];

export type CampaignRequiredLookSlot =
  (typeof CAMPAIGN_REQUIRED_LOOK_SLOTS)[number];

export const CAMPAIGN_CHALLENGE_DAY_COUNT = 7;

/** Maximum restrained rewards per customer per campaign (hard cap). */
export const CAMPAIGN_DEFAULT_REWARD_CAP = 1;

/** Short-lived offer default TTL in hours. */
export const CAMPAIGN_SHORT_LIVED_OFFER_HOURS = 72;

export interface CampaignQuietHours {
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface Campaign {
  readonly id: CampaignId;
  readonly retailerId: RetailerId;
  readonly kind: CampaignKind;
  readonly status: CampaignStatus;
  readonly title: string;
  readonly summary: string;
  readonly frequency: CampaignScheduleFrequency;
  readonly timezone: string;
  readonly preferredLocalHour: number;
  readonly quietHours?: CampaignQuietHours;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly rewardKind?: CampaignRewardKind;
  readonly rewardLabel?: string;
  readonly rewardCapPerCustomer: number;
  readonly shortLivedOfferHours: number;
  readonly explanation: string;
  readonly createdByStaffId?: StaffId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignAudienceRule {
  readonly id: CampaignAudienceRuleId;
  readonly campaignId: CampaignId;
  readonly retailerId: RetailerId;
  readonly ruleKind: CampaignAudienceRuleKind;
  readonly conceptId?: MetadataConceptId;
  readonly productId?: ProductId;
  readonly loyaltyTier?: "member" | "silver" | "gold" | "platinum";
  readonly requirePersonalizationConsent: boolean;
  readonly explanation: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignTargetProduct {
  readonly campaignId: CampaignId;
  readonly retailerId: RetailerId;
  readonly productId: ProductId;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignChallengeEnrollment {
  readonly id: CampaignChallengeEnrollmentId;
  readonly campaignId: CampaignId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly status: CampaignEnrollmentStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly withdrawnAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const CAMPAIGN_SLOT_SOURCE_KINDS = ["owned", "catalogue_suggested"] as const;

export type CampaignSlotSourceKind =
  (typeof CAMPAIGN_SLOT_SOURCE_KINDS)[number];

export interface CampaignChallengeLookSlot {
  readonly id: CampaignChallengeLookSlotId;
  readonly lookId: CampaignChallengeLookId;
  readonly retailerId: RetailerId;
  readonly slotKind: OutfitSlotKind;
  readonly sourceKind: CampaignSlotSourceKind;
  readonly wardrobeItemId?: WardrobeItemId;
  readonly productId?: ProductId;
  readonly displayOrder: number;
}

export interface CampaignChallengeLookGapCitation {
  readonly slotKind: OutfitSlotKind;
  readonly explanation: string;
  readonly factCitation?: string;
  readonly ruleCitation?: string;
}

export interface CampaignChallengeLook {
  readonly id: CampaignChallengeLookId;
  readonly enrollmentId: CampaignChallengeEnrollmentId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly dayIndex: number;
  readonly title: string;
  readonly occasionLabel?: string;
  readonly gapCitations: readonly CampaignChallengeLookGapCitation[];
  readonly slots: readonly CampaignChallengeLookSlot[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignCompletion {
  readonly id: CampaignCompletionId;
  readonly enrollmentId: CampaignChallengeEnrollmentId;
  readonly campaignId: CampaignId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly rewardGrantId?: CampaignRewardGrantId;
  readonly completedAt: string;
}

export interface CampaignRewardGrant {
  readonly id: CampaignRewardGrantId;
  readonly campaignId: CampaignId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly enrollmentId: CampaignChallengeEnrollmentId;
  readonly rewardKind: CampaignRewardKind;
  readonly label: string;
  readonly expiresAt?: string;
  readonly loyaltyLedgerEntryId?: LoyaltyLedgerEntryId;
  readonly createdAt: string;
}

export interface CampaignDeliveryAudit {
  readonly id: CampaignDeliveryAuditId;
  readonly campaignId: CampaignId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly forDate: string;
  readonly outcome: CampaignDeliveryOutcome;
  readonly suppressionReason?: CampaignSuppressionReason;
  readonly explanation?: string;
  readonly personalizationConsent?: ConsentStatus;
  readonly notificationId?: NotificationId;
  readonly scheduledFor: string;
  readonly createdAt: string;
}

export function isCampaignScheduleFrequency(
  value: string,
): value is CampaignScheduleFrequency {
  return (CAMPAIGN_SCHEDULE_FREQUENCIES as readonly string[]).includes(value);
}

export function toMorningRoutineFrequency(
  frequency: CampaignScheduleFrequency,
): MorningRoutineDeliveryFrequency {
  return frequency;
}

export function slotHasReference(slot: {
  readonly productId?: ProductId | string | null;
  readonly wardrobeItemId?: WardrobeItemId | string | null;
}): boolean {
  const hasProduct =
    slot.productId !== undefined &&
    slot.productId !== null &&
    slot.productId !== "";
  const hasWardrobe =
    slot.wardrobeItemId !== undefined &&
    slot.wardrobeItemId !== null &&
    slot.wardrobeItemId !== "";
  return hasProduct || hasWardrobe;
}

export function isLookComplete(args: {
  readonly slots: readonly {
    readonly slotKind: OutfitSlotKind;
    readonly productId?: ProductId | string | null;
    readonly wardrobeItemId?: WardrobeItemId | string | null;
  }[];
}): boolean {
  for (const required of CAMPAIGN_REQUIRED_LOOK_SLOTS) {
    const slot = args.slots.find((entry) => entry.slotKind === required);
    if (!slot || !slotHasReference(slot)) {
      return false;
    }
  }
  return true;
}

export function challengeCompleteness(args: {
  readonly looks: readonly {
    readonly dayIndex: number;
    readonly slots: readonly {
      readonly slotKind: OutfitSlotKind;
      readonly productId?: ProductId | string | null;
      readonly wardrobeItemId?: WardrobeItemId | string | null;
    }[];
  }[];
}): {
  readonly completeDayCount: number;
  readonly missingDayIndexes: readonly number[];
  readonly isComplete: boolean;
} {
  const byDay = new Map(args.looks.map((look) => [look.dayIndex, look]));
  const missingDayIndexes: number[] = [];
  let completeDayCount = 0;
  for (let day = 1; day <= CAMPAIGN_CHALLENGE_DAY_COUNT; day += 1) {
    const look = byDay.get(day);
    if (!look || !isLookComplete({ slots: look.slots })) {
      missingDayIndexes.push(day);
    } else {
      completeDayCount += 1;
    }
  }
  return {
    completeDayCount,
    missingDayIndexes,
    isComplete: missingDayIndexes.length === 0,
  };
}

export function evaluateAudienceRules(args: {
  readonly rules: readonly Pick<
    CampaignAudienceRule,
    | "ruleKind"
    | "conceptId"
    | "productId"
    | "loyaltyTier"
    | "requirePersonalizationConsent"
    | "active"
    | "explanation"
  >[];
  readonly personalizationConsent: ConsentStatus;
  readonly customerConceptIds: ReadonlySet<string>;
  readonly customerProductInterestIds?: ReadonlySet<string>;
  readonly loyaltyTier?: "member" | "silver" | "gold" | "platinum";
}):
  | { readonly ok: true; readonly matchedExplanations: readonly string[] }
  | {
      readonly ok: false;
      readonly reason: CampaignSuppressionReason;
      readonly explanation: string;
    } {
  const active = args.rules.filter((rule) => rule.active);
  if (active.length === 0) {
    if (args.personalizationConsent !== "granted") {
      return {
        ok: false,
        reason: "no_personalization_consent",
        explanation:
          "Private offers require personalization consent; marketing consent is never reused.",
      };
    }
    return { ok: true, matchedExplanations: ["Open to consented members."] };
  }

  const matchedExplanations: string[] = [];
  for (const rule of active) {
    if (
      rule.requirePersonalizationConsent &&
      args.personalizationConsent !== "granted"
    ) {
      return {
        ok: false,
        reason: "no_personalization_consent",
        explanation: rule.explanation,
      };
    }

    switch (rule.ruleKind) {
      case "personalization_consent":
        if (args.personalizationConsent !== "granted") {
          return {
            ok: false,
            reason: "no_personalization_consent",
            explanation: rule.explanation,
          };
        }
        matchedExplanations.push(rule.explanation);
        break;
      case "fabric_concept":
      case "category_concept":
      case "style_preference": {
        const conceptId = rule.conceptId;
        if (!conceptId || !args.customerConceptIds.has(conceptId)) {
          return {
            ok: false,
            reason: "audience_mismatch",
            explanation: rule.explanation,
          };
        }
        matchedExplanations.push(rule.explanation);
        break;
      }
      case "product": {
        const productId = rule.productId;
        const interests = args.customerProductInterestIds ?? new Set<string>();
        if (!productId || !interests.has(productId)) {
          return {
            ok: false,
            reason: "audience_mismatch",
            explanation: rule.explanation,
          };
        }
        matchedExplanations.push(rule.explanation);
        break;
      }
      case "loyalty_tier": {
        if (!rule.loyaltyTier || args.loyaltyTier !== rule.loyaltyTier) {
          return {
            ok: false,
            reason: "audience_mismatch",
            explanation: rule.explanation,
          };
        }
        matchedExplanations.push(rule.explanation);
        break;
      }
      default: {
        const _exhaustive: never = rule.ruleKind;
        return _exhaustive;
      }
    }
  }

  return { ok: true, matchedExplanations };
}

export function evaluateCampaignSchedule(args: {
  readonly campaign: Pick<
    Campaign,
    | "status"
    | "frequency"
    | "timezone"
    | "preferredLocalHour"
    | "quietHours"
    | "startsAt"
    | "endsAt"
  >;
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
  const forDate = localDateInTimezone(args.nowUtcIso, args.campaign.timezone);

  if (args.campaign.status === "paused") {
    return {
      ok: false,
      forDate,
      outcome: "skipped_campaign_inactive",
      suppressionReason: "campaign_paused",
    };
  }
  if (args.campaign.status === "ended" || args.campaign.status === "draft") {
    return {
      ok: false,
      forDate,
      outcome: "skipped_campaign_inactive",
      suppressionReason: "campaign_ended",
    };
  }
  if (args.alreadyDeliveredForDate) {
    return {
      ok: false,
      forDate,
      outcome: "skipped_duplicate",
      suppressionReason: "duplicate_for_date",
    };
  }

  const nowMs = Date.parse(args.nowUtcIso);
  if (args.campaign.startsAt && nowMs < Date.parse(args.campaign.startsAt)) {
    return {
      ok: false,
      forDate,
      outcome: "skipped_schedule",
      suppressionReason: "schedule_outside_window",
    };
  }
  if (args.campaign.endsAt && nowMs > Date.parse(args.campaign.endsAt)) {
    return {
      ok: false,
      forDate,
      outcome: "skipped_schedule",
      suppressionReason: "schedule_outside_window",
    };
  }

  const weekday = localWeekdayInTimezone(
    args.nowUtcIso,
    args.campaign.timezone,
  );
  if (
    !matchesDeliveryFrequency({
      frequency: toMorningRoutineFrequency(args.campaign.frequency),
      forDate,
      weekday,
    })
  ) {
    return { ok: false, forDate, outcome: "skipped_schedule" };
  }

  const localMinute = localMinutesInTimezone(
    args.nowUtcIso,
    args.campaign.timezone,
  );
  const quiet: MorningRoutineQuietHours | undefined = args.campaign.quietHours;
  if (isInQuietHours(localMinute, quiet)) {
    return { ok: false, forDate, outcome: "skipped_quiet_hours" };
  }
  if (localMinute < args.campaign.preferredLocalHour * 60) {
    return { ok: false, forDate, outcome: "skipped_quiet_hours" };
  }

  return { ok: true, forDate };
}

/**
 * Pure delivery gate combining schedule + audience. Does not enqueue.
 */
export function evaluateCampaignDelivery(args: {
  readonly campaign: Pick<
    Campaign,
    | "status"
    | "frequency"
    | "timezone"
    | "preferredLocalHour"
    | "quietHours"
    | "startsAt"
    | "endsAt"
    | "explanation"
  >;
  readonly rules: readonly CampaignAudienceRule[];
  readonly personalizationConsent: ConsentStatus;
  readonly customerConceptIds: ReadonlySet<string>;
  readonly customerProductInterestIds?: ReadonlySet<string>;
  readonly loyaltyTier?: "member" | "silver" | "gold" | "platinum";
  readonly nowUtcIso: string;
  readonly alreadyDeliveredForDate: boolean;
}):
  | {
      readonly ok: true;
      readonly forDate: string;
      readonly matchedExplanations: readonly string[];
    }
  | {
      readonly ok: false;
      readonly forDate: string;
      readonly outcome: CampaignDeliveryOutcome;
      readonly suppressionReason?: CampaignSuppressionReason;
      readonly explanation?: string;
    } {
  const schedule = evaluateCampaignSchedule({
    campaign: args.campaign,
    nowUtcIso: args.nowUtcIso,
    alreadyDeliveredForDate: args.alreadyDeliveredForDate,
  });
  if (!schedule.ok) {
    return schedule;
  }

  if (args.personalizationConsent === "withdrawn") {
    return {
      ok: false,
      forDate: schedule.forDate,
      outcome: "skipped_consent_withdrawn",
      suppressionReason: "customer_withdrawn",
      explanation:
        "Personalization consent was withdrawn; delivery stops without erasing durable records.",
    };
  }

  const audience = evaluateAudienceRules({
    rules: args.rules,
    personalizationConsent: args.personalizationConsent,
    customerConceptIds: args.customerConceptIds,
    ...(args.customerProductInterestIds
      ? { customerProductInterestIds: args.customerProductInterestIds }
      : {}),
    ...(args.loyaltyTier ? { loyaltyTier: args.loyaltyTier } : {}),
  });
  if (!audience.ok) {
    return {
      ok: false,
      forDate: schedule.forDate,
      outcome:
        audience.reason === "no_personalization_consent"
          ? "skipped_consent_withdrawn"
          : "skipped_audience",
      suppressionReason: audience.reason,
      explanation: audience.explanation,
    };
  }

  return {
    ok: true,
    forDate: schedule.forDate,
    matchedExplanations: audience.matchedExplanations,
  };
}

export function resolveChallengeReward(args: {
  readonly campaign: Pick<
    Campaign,
    | "rewardKind"
    | "rewardLabel"
    | "rewardCapPerCustomer"
    | "shortLivedOfferHours"
  >;
  readonly existingGrantCount: number;
  readonly alreadyCompleted: boolean;
  readonly completeness: ReturnType<typeof challengeCompleteness>;
  readonly nowUtcIso: string;
}):
  | {
      readonly ok: true;
      readonly rewardKind: CampaignRewardKind;
      readonly label: string;
      readonly expiresAt?: string;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "incomplete"
        | "already_completed"
        | "reward_cap"
        | "no_reward_configured";
    } {
  if (args.alreadyCompleted) {
    return { ok: false, reason: "already_completed" };
  }
  if (!args.completeness.isComplete) {
    return { ok: false, reason: "incomplete" };
  }
  if (!args.campaign.rewardKind) {
    return { ok: false, reason: "no_reward_configured" };
  }
  const cap = Math.max(1, args.campaign.rewardCapPerCustomer);
  if (args.existingGrantCount >= cap) {
    return { ok: false, reason: "reward_cap" };
  }

  const label =
    args.campaign.rewardLabel?.trim() ||
    defaultRewardLabel(args.campaign.rewardKind);

  if (args.campaign.rewardKind === "short_lived_offer") {
    const hours = Math.max(1, args.campaign.shortLivedOfferHours);
    const expiresAt = new Date(
      Date.parse(args.nowUtcIso) + hours * 60 * 60 * 1000,
    ).toISOString();
    return {
      ok: true,
      rewardKind: args.campaign.rewardKind,
      label,
      expiresAt,
    };
  }

  return {
    ok: true,
    rewardKind: args.campaign.rewardKind,
    label,
  };
}

export function defaultRewardLabel(kind: CampaignRewardKind): string {
  switch (kind) {
    case "personalized_tie":
      return "A personalised tie";
    case "personalized_shirt":
      return "A personalised shirt";
    case "short_lived_offer":
      return "A short-lived member offer";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function buildCampaignDeliveryNotification(args: {
  readonly title: string;
  readonly forDate: string;
  readonly explanation: string;
}): {
  readonly title: string;
  readonly body: string;
  readonly actionHref: string;
} {
  return {
    title: args.title,
    body: `${args.explanation} Available privately for ${args.forDate}.`,
    actionHref: "/private-offers",
  };
}

export function isValidCampaignDayIndex(dayIndex: number): boolean {
  return (
    Number.isInteger(dayIndex) &&
    dayIndex >= 1 &&
    dayIndex <= CAMPAIGN_CHALLENGE_DAY_COUNT
  );
}

export function isKnownOutfitSlotKind(value: string): value is OutfitSlotKind {
  return (OUTFIT_SLOT_KINDS as readonly string[]).includes(value);
}
