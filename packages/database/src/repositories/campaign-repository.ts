/**
 * Campaign private offers and seven-day wardrobe challenges (PHASE 5.1).
 */

import {
  asId,
  type CampaignDeliveryAudit,
  type CampaignDeliveryOutcome,
  type CampaignEnrollmentId,
  type CampaignId,
  type CampaignKind,
  type CampaignRewardGrant,
  type CampaignRewardGrantId,
  type CampaignRewardKind,
  type CampaignRewardStatus,
  type CampaignScheduleFrequency,
  type CampaignSuppressionReason,
  type CampaignTarget,
  type CampaignTargetId,
  type CampaignTargetType,
  type LoyaltyTier,
  type OutfitSlotKind,
  type ProductId,
  type RetailerCampaign,
  type SaveWardrobeChallengeDayLookInput,
  type SetCampaignTargetInput,
  type UpsertRetailerCampaignInput,
  type WardrobeChallengeDayLook,
  type WardrobeChallengeEnrollment,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type CampaignRow = Database["public"]["Tables"]["retailer_campaigns"]["Row"];
type TargetRow =
  Database["public"]["Tables"]["retailer_campaign_targets"]["Row"];
type EnrollmentRow =
  Database["public"]["Tables"]["wardrobe_challenge_enrollments"]["Row"];
type DayLookRow =
  Database["public"]["Tables"]["wardrobe_challenge_day_looks"]["Row"];
type RewardRow = Database["public"]["Tables"]["campaign_reward_grants"]["Row"];
type AuditRow = Database["public"]["Tables"]["campaign_delivery_audits"]["Row"];

function toCampaign(row: CampaignRow): RetailerCampaign {
  return {
    id: asId<"CampaignId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    kind: row.kind as CampaignKind,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    active: row.active,
    paused: row.paused,
    scheduleFrequency: row.schedule_frequency as CampaignScheduleFrequency,
    timezone: row.timezone,
    ...(row.starts_at ? { startsAt: row.starts_at } : {}),
    ...(row.ends_at ? { endsAt: row.ends_at } : {}),
    ...(row.reward_kind
      ? { rewardKind: row.reward_kind as CampaignRewardKind }
      : {}),
    rewardCapPerCustomer: row.reward_cap_per_customer,
    ...(row.reward_expires_days
      ? { rewardExpiresDays: row.reward_expires_days }
      : {}),
    requiresPersonalizationConsent: row.requires_personalization_consent,
    ...(row.minimum_loyalty_tier
      ? { minimumLoyaltyTier: row.minimum_loyalty_tier as LoyaltyTier }
      : {}),
    ...(row.created_by_staff_id
      ? { createdByStaffId: asId<"StaffId">(row.created_by_staff_id) }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTarget(row: TargetRow): CampaignTarget {
  return {
    id: asId<"CampaignTargetId">(row.id),
    campaignId: asId<"CampaignId">(row.campaign_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    targetType: row.target_type as CampaignTargetType,
    targetId: row.target_id,
    label: row.label,
    createdAt: row.created_at,
  };
}

function toEnrollment(row: EnrollmentRow): WardrobeChallengeEnrollment {
  return {
    id: asId<"CampaignEnrollmentId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    campaignId: asId<"CampaignId">(row.campaign_id),
    status: row.status as WardrobeChallengeEnrollment["status"],
    startedAt: row.started_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dayLookSlots(row: DayLookRow): WardrobeChallengeDayLook["slots"] {
  const slots: Partial<Record<OutfitSlotKind, ProductId>> = {};
  if (row.jacket_product_id) {
    slots.jacket = asId<"ProductId">(row.jacket_product_id);
  }
  if (row.trousers_product_id) {
    slots.trousers = asId<"ProductId">(row.trousers_product_id);
  }
  if (row.shirt_product_id) {
    slots.shirt = asId<"ProductId">(row.shirt_product_id);
  }
  if (row.shoes_product_id) {
    slots.shoes = asId<"ProductId">(row.shoes_product_id);
  }
  if (row.accessories_product_id) {
    slots.accessories = asId<"ProductId">(row.accessories_product_id);
  }
  if (row.pocket_square_product_id) {
    slots.pocket_square = asId<"ProductId">(row.pocket_square_product_id);
  }
  return slots;
}

function toDayLook(row: DayLookRow): WardrobeChallengeDayLook {
  return {
    id: row.id,
    enrollmentId: asId<"CampaignEnrollmentId">(row.enrollment_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    dayIndex: row.day_index,
    slots: dayLookSlots(row),
    savedAt: row.saved_at,
  };
}

function toReward(row: RewardRow): CampaignRewardGrant {
  return {
    id: asId<"CampaignRewardGrantId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    campaignId: asId<"CampaignId">(row.campaign_id),
    ...(row.enrollment_id
      ? { enrollmentId: asId<"CampaignEnrollmentId">(row.enrollment_id) }
      : {}),
    rewardKind: row.reward_kind as CampaignRewardKind,
    status: row.status as CampaignRewardStatus,
    code: row.code,
    ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
    createdAt: row.created_at,
  };
}

function toAudit(row: AuditRow): CampaignDeliveryAudit {
  return {
    id: asId<"CampaignDeliveryAuditId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    campaignId: asId<"CampaignId">(row.campaign_id),
    forDate: row.for_date,
    outcome: row.outcome as CampaignDeliveryOutcome,
    ...(row.suppression_reason
      ? {
          suppressionReason:
            row.suppression_reason as CampaignSuppressionReason,
        }
      : {}),
    ...(row.notification_id
      ? { notificationId: asId<"NotificationId">(row.notification_id) }
      : {}),
    scheduledFor: row.scheduled_for,
    createdAt: row.created_at,
  };
}

export class CampaignRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listByRetailer(retailerId: string): Promise<RetailerCampaign[]> {
    const { data, error } = await this.client
      .from("retailer_campaigns")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toCampaign);
  }

  async listActiveForRetailer(
    retailerId: string,
    kind?: CampaignKind,
  ): Promise<RetailerCampaign[]> {
    let query = this.client
      .from("retailer_campaigns")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("active", true)
      .eq("paused", false);
    if (kind) query = query.eq("kind", kind);
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) throw error;
    return data.map(toCampaign);
  }

  async findById(campaignId: string): Promise<RetailerCampaign | null> {
    const { data, error } = await this.client
      .from("retailer_campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();
    if (error) throw error;
    return data ? toCampaign(data) : null;
  }

  async upsertCampaign(
    retailerId: string,
    input: UpsertRetailerCampaignInput,
  ): Promise<CampaignId> {
    const { data, error } = await this.client.rpc("upsert_retailer_campaign", {
      p_retailer_id: retailerId,
      p_kind: input.kind,
      p_title: input.title,
      p_active: input.active,
      p_paused: input.paused,
      p_schedule_frequency: input.scheduleFrequency,
      p_timezone: input.timezone,
      p_reward_cap_per_customer: input.rewardCapPerCustomer,
      p_requires_personalization_consent: input.requiresPersonalizationConsent,
      ...(input.description ? { p_description: input.description } : {}),
      ...(input.startsAt ? { p_starts_at: input.startsAt } : {}),
      ...(input.endsAt ? { p_ends_at: input.endsAt } : {}),
      ...(input.rewardKind ? { p_reward_kind: input.rewardKind } : {}),
      ...(input.rewardExpiresDays
        ? { p_reward_expires_days: input.rewardExpiresDays }
        : {}),
      ...(input.minimumLoyaltyTier
        ? { p_minimum_loyalty_tier: input.minimumLoyaltyTier }
        : {}),
      ...(input.campaignId ? { p_campaign_id: input.campaignId } : {}),
    });
    if (error) throw error;
    return asId<"CampaignId">(data);
  }

  async setTarget(
    retailerId: string,
    input: SetCampaignTargetInput,
  ): Promise<CampaignTargetId | null> {
    const { data, error } = await this.client.rpc("set_campaign_target", {
      p_retailer_id: retailerId,
      p_campaign_id: input.campaignId,
      p_target_type: input.targetType,
      p_target_id: input.targetId,
      p_label: input.label,
      p_remove: input.remove ?? false,
    });
    if (error) throw error;
    return data ? asId<"CampaignTargetId">(data) : null;
  }

  async listTargets(campaignId: string): Promise<CampaignTarget[]> {
    const { data, error } = await this.client
      .from("retailer_campaign_targets")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(toTarget);
  }

  async startWardrobeChallenge(args: {
    readonly retailerId: string;
    readonly customerId: string;
    readonly campaignId: string;
  }): Promise<CampaignEnrollmentId> {
    const { data, error } = await this.client.rpc("start_wardrobe_challenge", {
      p_retailer_id: args.retailerId,
      p_customer_id: args.customerId,
      p_campaign_id: args.campaignId,
    });
    if (error) throw error;
    return asId<"CampaignEnrollmentId">(data);
  }

  async findEnrollment(
    customerId: string,
    campaignId: string,
  ): Promise<WardrobeChallengeEnrollment | null> {
    const { data, error } = await this.client
      .from("wardrobe_challenge_enrollments")
      .select("*")
      .eq("customer_id", customerId)
      .eq("campaign_id", campaignId)
      .maybeSingle();
    if (error) throw error;
    return data ? toEnrollment(data) : null;
  }

  async listEnrollmentsForCustomer(
    customerId: string,
  ): Promise<WardrobeChallengeEnrollment[]> {
    const { data, error } = await this.client
      .from("wardrobe_challenge_enrollments")
      .select("*")
      .eq("customer_id", customerId)
      .order("started_at", { ascending: false });
    if (error) throw error;
    return data.map(toEnrollment);
  }

  async saveDayLook(input: SaveWardrobeChallengeDayLookInput): Promise<string> {
    const slots = input.slots;
    const { data, error } = await this.client.rpc(
      "save_wardrobe_challenge_day_look",
      {
        p_enrollment_id: input.enrollmentId,
        p_day_index: input.dayIndex,
        ...(slots.jacket ? { p_jacket_product_id: slots.jacket } : {}),
        ...(slots.trousers ? { p_trousers_product_id: slots.trousers } : {}),
        ...(slots.shirt ? { p_shirt_product_id: slots.shirt } : {}),
        ...(slots.shoes ? { p_shoes_product_id: slots.shoes } : {}),
        ...(slots.accessories
          ? { p_accessories_product_id: slots.accessories }
          : {}),
        ...(slots.pocket_square
          ? { p_pocket_square_product_id: slots.pocket_square }
          : {}),
      },
    );
    if (error) throw error;
    return data;
  }

  async listDayLooks(
    enrollmentId: string,
  ): Promise<WardrobeChallengeDayLook[]> {
    const { data, error } = await this.client
      .from("wardrobe_challenge_day_looks")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .order("day_index", { ascending: true });
    if (error) throw error;
    return data.map(toDayLook);
  }

  async completeChallenge(
    enrollmentId: string,
  ): Promise<CampaignRewardGrantId> {
    const { data, error } = await this.client.rpc(
      "complete_wardrobe_challenge",
      { p_enrollment_id: enrollmentId },
    );
    if (error) throw error;
    return asId<"CampaignRewardGrantId">(data);
  }

  async findRewardGrant(
    customerId: string,
    campaignId: string,
  ): Promise<CampaignRewardGrant | null> {
    const { data, error } = await this.client
      .from("campaign_reward_grants")
      .select("*")
      .eq("customer_id", customerId)
      .eq("campaign_id", campaignId)
      .maybeSingle();
    if (error) throw error;
    return data ? toReward(data) : null;
  }

  async listRewardGrantsForCustomer(
    customerId: string,
  ): Promise<CampaignRewardGrant[]> {
    const { data, error } = await this.client
      .from("campaign_reward_grants")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toReward);
  }

  async hasSuccessfulDelivery(
    customerId: string,
    campaignId: string,
    forDate: string,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("campaign_delivery_audits")
      .select("id")
      .eq("customer_id", customerId)
      .eq("campaign_id", campaignId)
      .eq("for_date", forDate)
      .eq("outcome", "delivered")
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  async recordDeliveryAudit(args: {
    readonly retailerId: string;
    readonly customerId: string;
    readonly campaignId: string;
    readonly forDate: string;
    readonly outcome: CampaignDeliveryOutcome;
    readonly scheduledFor: string;
    readonly suppressionReason?: CampaignSuppressionReason;
    readonly notificationId?: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "record_campaign_delivery_audit",
      {
        p_retailer_id: args.retailerId,
        p_customer_id: args.customerId,
        p_campaign_id: args.campaignId,
        p_for_date: args.forDate,
        p_outcome: args.outcome,
        p_scheduled_for: args.scheduledFor,
        ...(args.suppressionReason
          ? { p_suppression_reason: args.suppressionReason }
          : {}),
        ...(args.notificationId
          ? { p_notification_id: args.notificationId }
          : {}),
      },
    );
    if (error) throw error;
    return data;
  }

  async enqueueOfferNotification(args: {
    readonly retailerId: string;
    readonly customerId: string;
    readonly campaignId: string;
    readonly title: string;
    readonly body: string;
    readonly actionHref?: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "enqueue_campaign_offer_notification",
      {
        p_retailer_id: args.retailerId,
        p_customer_id: args.customerId,
        p_campaign_id: args.campaignId,
        p_title: args.title,
        p_body: args.body,
        p_action_href: args.actionHref ?? "/private-offers",
      },
    );
    if (error) throw error;
    return data;
  }

  async listDeliveryAuditsForCustomer(
    customerId: string,
    limit = 20,
  ): Promise<CampaignDeliveryAudit[]> {
    const { data, error } = await this.client
      .from("campaign_delivery_audits")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toAudit);
  }
}
