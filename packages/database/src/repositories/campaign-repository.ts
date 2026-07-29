/**
 * Private offers and seven-day wardrobe campaigns (PHASE 5.1).
 */

import {
  asId,
  type Campaign,
  type CampaignAudienceRule,
  type CampaignAudienceRuleKind,
  type CampaignChallengeEnrollment,
  type CampaignChallengeLook,
  type CampaignChallengeLookSlot,
  type CampaignCompletion,
  type CampaignDeliveryAudit,
  type CampaignDeliveryOutcome,
  type CampaignEnrollmentStatus,
  type CampaignId,
  type CampaignKind,
  type CampaignRewardGrant,
  type CampaignRewardKind,
  type CampaignScheduleFrequency,
  type CampaignStatus,
  type CampaignSuppressionReason,
  type ConsentStatus,
  type OutfitSlotKind,
  type SetCampaignTargetProductInput,
  type UpsertCampaignAudienceRuleInput,
  type UpsertCampaignChallengeLookInput,
  type UpsertCampaignInput,
  type CampaignTargetProduct,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
type AudienceRow =
  Database["public"]["Tables"]["campaign_audience_rules"]["Row"];
type TargetRow =
  Database["public"]["Tables"]["campaign_target_products"]["Row"];
type EnrollmentRow =
  Database["public"]["Tables"]["campaign_challenge_enrollments"]["Row"];
type LookRow = Database["public"]["Tables"]["campaign_challenge_looks"]["Row"];
type SlotRow =
  Database["public"]["Tables"]["campaign_challenge_look_slots"]["Row"];
type CompletionRow =
  Database["public"]["Tables"]["campaign_completions"]["Row"];
type GrantRow = Database["public"]["Tables"]["campaign_reward_grants"]["Row"];
type AuditRow = Database["public"]["Tables"]["campaign_delivery_audits"]["Row"];

function toCampaign(row: CampaignRow): Campaign {
  return {
    id: asId<"CampaignId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    kind: row.kind as CampaignKind,
    status: row.status as CampaignStatus,
    title: row.title,
    summary: row.summary,
    explanation: row.explanation,
    frequency: row.frequency as CampaignScheduleFrequency,
    timezone: row.timezone,
    preferredLocalHour: row.preferred_local_hour,
    ...(row.quiet_start_minute !== null && row.quiet_end_minute !== null
      ? {
          quietHours: {
            startMinute: row.quiet_start_minute,
            endMinute: row.quiet_end_minute,
          },
        }
      : {}),
    ...(row.starts_at ? { startsAt: row.starts_at } : {}),
    ...(row.ends_at ? { endsAt: row.ends_at } : {}),
    ...(row.reward_kind
      ? { rewardKind: row.reward_kind as CampaignRewardKind }
      : {}),
    ...(row.reward_label ? { rewardLabel: row.reward_label } : {}),
    rewardCapPerCustomer: row.reward_cap_per_customer,
    shortLivedOfferHours: row.short_lived_offer_hours,
    ...(row.created_by_staff_id
      ? { createdByStaffId: asId<"StaffId">(row.created_by_staff_id) }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAudienceRule(row: AudienceRow): CampaignAudienceRule {
  return {
    id: asId<"CampaignAudienceRuleId">(row.id),
    campaignId: asId<"CampaignId">(row.campaign_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    ruleKind: row.rule_kind as CampaignAudienceRuleKind,
    ...(row.concept_id
      ? { conceptId: asId<"MetadataConceptId">(row.concept_id) }
      : {}),
    ...(row.product_id ? { productId: asId<"ProductId">(row.product_id) } : {}),
    ...(row.loyalty_tier
      ? {
          loyaltyTier: row.loyalty_tier as
            "member" | "silver" | "gold" | "platinum",
        }
      : {}),
    requirePersonalizationConsent: row.require_personalization_consent,
    explanation: row.explanation,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTarget(row: TargetRow): CampaignTargetProduct {
  return {
    campaignId: asId<"CampaignId">(row.campaign_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    productId: asId<"ProductId">(row.product_id),
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEnrollment(row: EnrollmentRow): CampaignChallengeEnrollment {
  return {
    id: asId<"CampaignChallengeEnrollmentId">(row.id),
    campaignId: asId<"CampaignId">(row.campaign_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    status: row.status as CampaignEnrollmentStatus,
    startedAt: row.started_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.withdrawn_at ? { withdrawnAt: row.withdrawn_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSlot(row: SlotRow): CampaignChallengeLookSlot {
  return {
    id: asId<"CampaignChallengeLookSlotId">(row.id),
    lookId: asId<"CampaignChallengeLookId">(row.look_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    slotKind: row.slot_kind as OutfitSlotKind,
    productId: asId<"ProductId">(row.product_id),
    displayOrder: row.display_order,
  };
}

function toLook(row: LookRow, slots: SlotRow[]): CampaignChallengeLook {
  return {
    id: asId<"CampaignChallengeLookId">(row.id),
    enrollmentId: asId<"CampaignChallengeEnrollmentId">(row.enrollment_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    dayIndex: row.day_index,
    title: row.title,
    slots: slots.map(toSlot),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCompletion(row: CompletionRow): CampaignCompletion {
  return {
    id: asId<"CampaignCompletionId">(row.id),
    enrollmentId: asId<"CampaignChallengeEnrollmentId">(row.enrollment_id),
    campaignId: asId<"CampaignId">(row.campaign_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    ...(row.reward_grant_id
      ? { rewardGrantId: asId<"CampaignRewardGrantId">(row.reward_grant_id) }
      : {}),
    completedAt: row.completed_at,
  };
}

function toGrant(row: GrantRow): CampaignRewardGrant {
  return {
    id: asId<"CampaignRewardGrantId">(row.id),
    campaignId: asId<"CampaignId">(row.campaign_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    enrollmentId: asId<"CampaignChallengeEnrollmentId">(row.enrollment_id),
    rewardKind: row.reward_kind as CampaignRewardKind,
    label: row.label,
    ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
    ...(row.loyalty_ledger_entry_id
      ? {
          loyaltyLedgerEntryId: asId<"LoyaltyLedgerEntryId">(
            row.loyalty_ledger_entry_id,
          ),
        }
      : {}),
    createdAt: row.created_at,
  };
}

function toAudit(row: AuditRow): CampaignDeliveryAudit {
  return {
    id: asId<"CampaignDeliveryAuditId">(row.id),
    campaignId: asId<"CampaignId">(row.campaign_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    forDate: row.for_date,
    outcome: row.outcome as CampaignDeliveryOutcome,
    ...(row.suppression_reason
      ? {
          suppressionReason:
            row.suppression_reason as CampaignSuppressionReason,
        }
      : {}),
    ...(row.explanation ? { explanation: row.explanation } : {}),
    ...(row.personalization_consent
      ? {
          personalizationConsent: row.personalization_consent as ConsentStatus,
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

  async listByRetailer(retailerId: string): Promise<Campaign[]> {
    const { data, error } = await this.client
      .from("campaigns")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(toCampaign);
  }

  async listActiveByRetailer(retailerId: string): Promise<Campaign[]> {
    const { data, error } = await this.client
      .from("campaigns")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("status", "active")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(toCampaign);
  }

  async listActivePrivateOffers(): Promise<Campaign[]> {
    const { data, error } = await this.client
      .from("campaigns")
      .select("*")
      .eq("status", "active")
      .eq("kind", "private_offer")
      .order("updated_at", { ascending: true })
      .limit(100);
    if (error) throw error;
    return data.map(toCampaign);
  }

  async findById(campaignId: string): Promise<Campaign | null> {
    const { data, error } = await this.client
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();
    if (error) throw error;
    return data ? toCampaign(data) : null;
  }

  async upsertCampaign(
    retailerId: string,
    input: UpsertCampaignInput,
    staffId?: string,
  ): Promise<CampaignId> {
    const payload = {
      retailer_id: retailerId,
      kind: input.kind,
      status: input.status,
      title: input.title,
      summary: input.summary,
      explanation: input.explanation,
      frequency: input.frequency,
      timezone: input.timezone,
      preferred_local_hour: input.preferredLocalHour,
      quiet_start_minute: input.quietStartMinute ?? null,
      quiet_end_minute: input.quietEndMinute ?? null,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      reward_kind: input.rewardKind ?? null,
      reward_label: input.rewardLabel ?? null,
      reward_cap_per_customer: input.rewardCapPerCustomer,
      short_lived_offer_hours: input.shortLivedOfferHours,
      ...(staffId ? { created_by_staff_id: staffId } : {}),
    };

    if (input.campaignId) {
      const { data, error } = await this.client
        .from("campaigns")
        .update(payload)
        .eq("id", input.campaignId)
        .eq("retailer_id", retailerId)
        .select("id")
        .single();
      if (error) throw error;
      return asId<"CampaignId">(data.id);
    }

    const { data, error } = await this.client
      .from("campaigns")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return asId<"CampaignId">(data.id);
  }

  async setCampaignStatus(
    retailerId: string,
    campaignId: string,
    status: CampaignStatus,
  ): Promise<void> {
    const { error } = await this.client
      .from("campaigns")
      .update({ status })
      .eq("id", campaignId)
      .eq("retailer_id", retailerId);
    if (error) throw error;
  }

  async listAudienceRules(campaignId: string): Promise<CampaignAudienceRule[]> {
    const { data, error } = await this.client
      .from("campaign_audience_rules")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(toAudienceRule);
  }

  async upsertAudienceRule(
    retailerId: string,
    input: UpsertCampaignAudienceRuleInput,
  ): Promise<string> {
    const payload = {
      campaign_id: input.campaignId,
      retailer_id: retailerId,
      rule_kind: input.ruleKind,
      concept_id: input.conceptId ?? null,
      product_id: input.productId ?? null,
      loyalty_tier: input.loyaltyTier ?? null,
      require_personalization_consent: input.requirePersonalizationConsent,
      explanation: input.explanation,
      active: input.active,
    };

    if (input.ruleId) {
      const { data, error } = await this.client
        .from("campaign_audience_rules")
        .update(payload)
        .eq("id", input.ruleId)
        .eq("retailer_id", retailerId)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    }

    const { data, error } = await this.client
      .from("campaign_audience_rules")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async listTargetProducts(
    campaignId: string,
  ): Promise<CampaignTargetProduct[]> {
    const { data, error } = await this.client
      .from("campaign_target_products")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toTarget);
  }

  async setTargetProduct(
    retailerId: string,
    input: SetCampaignTargetProductInput,
  ): Promise<void> {
    const { error } = await this.client.from("campaign_target_products").upsert(
      {
        campaign_id: input.campaignId,
        retailer_id: retailerId,
        product_id: input.productId,
        active: input.active,
      },
      { onConflict: "campaign_id,product_id" },
    );
    if (error) throw error;
  }

  async enrollChallenge(args: {
    readonly campaignId: string;
    readonly retailerId: string;
    readonly customerId: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc("enroll_campaign_challenge", {
      p_campaign_id: args.campaignId,
      p_retailer_id: args.retailerId,
      p_customer_id: args.customerId,
    });
    if (error) throw error;
    return data;
  }

  async findEnrollment(
    campaignId: string,
    customerId: string,
  ): Promise<CampaignChallengeEnrollment | null> {
    const { data, error } = await this.client
      .from("campaign_challenge_enrollments")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (error) throw error;
    return data ? toEnrollment(data) : null;
  }

  async listEnrollmentsForCustomer(
    customerId: string,
  ): Promise<CampaignChallengeEnrollment[]> {
    const { data, error } = await this.client
      .from("campaign_challenge_enrollments")
      .select("*")
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(toEnrollment);
  }

  async listLooksForEnrollment(
    enrollmentId: string,
  ): Promise<CampaignChallengeLook[]> {
    const { data: looks, error } = await this.client
      .from("campaign_challenge_looks")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .order("day_index", { ascending: true });
    if (error) throw error;
    if (looks.length === 0) return [];

    const lookIds = looks.map((look) => look.id);
    const { data: slots, error: slotError } = await this.client
      .from("campaign_challenge_look_slots")
      .select("*")
      .in("look_id", lookIds)
      .order("display_order", { ascending: true });
    if (slotError) throw slotError;

    const slotsByLook = new Map<string, SlotRow[]>();
    for (const slot of slots) {
      const list = slotsByLook.get(slot.look_id) ?? [];
      list.push(slot);
      slotsByLook.set(slot.look_id, list);
    }

    return looks.map((look) => toLook(look, slotsByLook.get(look.id) ?? []));
  }

  async upsertChallengeLook(
    input: UpsertCampaignChallengeLookInput,
  ): Promise<string> {
    const slotsJson: Json = input.slots.map((slot) => ({
      slot_kind: slot.slotKind,
      product_id: slot.productId,
    }));
    const { data, error } = await this.client.rpc(
      "upsert_campaign_challenge_look",
      {
        p_enrollment_id: input.enrollmentId,
        p_day_index: input.dayIndex,
        p_title: input.title,
        p_slots: slotsJson,
      },
    );
    if (error) throw error;
    return data;
  }

  async completeChallenge(enrollmentId: string): Promise<string> {
    const { data, error } = await this.client.rpc(
      "complete_campaign_challenge",
      { p_enrollment_id: enrollmentId },
    );
    if (error) throw error;
    return data;
  }

  async findCompletion(
    enrollmentId: string,
  ): Promise<CampaignCompletion | null> {
    const { data, error } = await this.client
      .from("campaign_completions")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .maybeSingle();
    if (error) throw error;
    return data ? toCompletion(data) : null;
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
    return data.map(toGrant);
  }

  async listCustomersForRetailer(retailerId: string): Promise<
    {
      readonly id: string;
      readonly userId: string | null;
    }[]
  > {
    const { data, error } = await this.client
      .from("customers")
      .select("id, user_id")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .not("user_id", "is", null)
      .limit(500);
    if (error) throw error;
    return data.map((row) => ({
      id: row.id,
      userId: row.user_id,
    }));
  }

  async hasSuccessfulDelivery(
    campaignId: string,
    customerId: string,
    forDate: string,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("campaign_delivery_audits")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("customer_id", customerId)
      .eq("for_date", forDate)
      .in("outcome", ["queued_in_app", "queued_email"])
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  async recordDeliveryAudit(args: {
    readonly campaignId: string;
    readonly retailerId: string;
    readonly customerId: string;
    readonly forDate: string;
    readonly outcome: CampaignDeliveryOutcome;
    readonly scheduledFor: string;
    readonly suppressionReason?: CampaignSuppressionReason;
    readonly explanation?: string;
    readonly personalizationConsent?: ConsentStatus;
    readonly notificationId?: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "record_campaign_delivery_audit",
      {
        p_campaign_id: args.campaignId,
        p_retailer_id: args.retailerId,
        p_customer_id: args.customerId,
        p_for_date: args.forDate,
        p_outcome: args.outcome,
        p_scheduled_for: args.scheduledFor,
        ...(args.suppressionReason
          ? { p_suppression_reason: args.suppressionReason }
          : {}),
        ...(args.explanation ? { p_explanation: args.explanation } : {}),
        ...(args.personalizationConsent
          ? { p_personalization_consent: args.personalizationConsent }
          : {}),
        ...(args.notificationId
          ? { p_notification_id: args.notificationId }
          : {}),
      },
    );
    if (error) throw error;
    return data;
  }

  async enqueueDeliveryNotification(args: {
    readonly retailerId: string;
    readonly customerId: string;
    readonly title: string;
    readonly body: string;
    readonly actionHref?: string;
    readonly channel?: "in_app" | "email";
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "enqueue_campaign_delivery_notification",
      {
        p_retailer_id: args.retailerId,
        p_customer_id: args.customerId,
        p_title: args.title,
        p_body: args.body,
        ...(args.actionHref ? { p_action_href: args.actionHref } : {}),
        ...(args.channel ? { p_channel: args.channel } : {}),
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
