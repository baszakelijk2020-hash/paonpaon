import {
  asId,
  type CustomerId,
  type LoyaltyAccount,
  type LoyaltyAccountId,
  type LoyaltyLedgerEntry,
  type LoyaltyMilestoneAward,
  type LoyaltyMilestoneAwardStatus,
  type LoyaltyMilestoneDefinition,
  type LoyaltyMilestoneKind,
  type LoyaltyProgram,
  type LoyaltyTier,
  type MetadataConceptId,
  type OrderId,
  type Referral,
  type RetailerId,
  type Reward,
  type RewardRedemption,
  type RewardType,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ProgramRow = Database["public"]["Tables"]["loyalty_programs"]["Row"];
type AccountRow = Database["public"]["Tables"]["loyalty_accounts"]["Row"];
type LedgerRow = Database["public"]["Tables"]["loyalty_ledger_entries"]["Row"];
type RewardRow = Database["public"]["Tables"]["rewards"]["Row"];
type RedemptionRow = Database["public"]["Tables"]["reward_redemptions"]["Row"];
type ReferralRow = Database["public"]["Tables"]["referrals"]["Row"];
type MilestoneDefinitionRow =
  Database["public"]["Tables"]["loyalty_milestone_definitions"]["Row"];
type MilestoneAwardRow =
  Database["public"]["Tables"]["loyalty_milestone_awards"]["Row"];

const program = (row: ProgramRow): LoyaltyProgram => ({
  id: asId<"LoyaltyProgramId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  name: row.name,
  enabled: row.enabled,
  pointsPerCurrencyUnit: row.points_per_currency_unit,
  referralPoints: row.referral_points,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});
const account = (row: AccountRow): LoyaltyAccount => ({
  id: asId<"LoyaltyAccountId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  customerId: asId<"CustomerId">(row.customer_id),
  tier: row.tier,
  pointsBalance: row.points_balance,
  lifetimePoints: row.lifetime_points,
  ...(row.tier_anniversary_at
    ? { tierAnniversaryAt: row.tier_anniversary_at }
    : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});
const ledger = (row: LedgerRow): LoyaltyLedgerEntry => ({
  id: asId<"LoyaltyLedgerEntryId">(row.id),
  loyaltyAccountId: asId<"LoyaltyAccountId">(row.loyalty_account_id),
  type: row.type,
  points: row.points,
  ...(row.related_order_id ? { relatedOrderId: row.related_order_id } : {}),
  ...(row.note ? { note: row.note } : {}),
  createdAt: row.created_at,
});
const reward = (row: RewardRow): Reward => ({
  id: asId<"RewardId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  name: row.name,
  type: row.type,
  pointsCost: row.points_cost,
  ...(row.minimum_tier ? { minimumTier: row.minimum_tier } : {}),
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});
const redemption = (row: RedemptionRow): RewardRedemption => ({
  id: asId<"RewardRedemptionId">(row.id),
  loyaltyAccountId: asId<"LoyaltyAccountId">(row.loyalty_account_id),
  rewardId: asId<"RewardId">(row.reward_id),
  pointsSpent: row.points_spent,
  status: row.status,
  code: row.code,
  createdAt: row.created_at,
  ...(row.used_at ? { usedAt: row.used_at } : {}),
});
const referral = (row: ReferralRow): Referral => ({
  id: asId<"ReferralId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  referringCustomerId: asId<"CustomerId">(row.referring_customer_id),
  referredEmail: row.referred_email,
  code: row.code,
  ...(row.referred_customer_id
    ? { referredCustomerId: asId<"CustomerId">(row.referred_customer_id) }
    : {}),
  status: row.status,
  ...(row.reward_id ? { rewardId: asId<"RewardId">(row.reward_id) } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});
const milestoneDefinition = (
  row: MilestoneDefinitionRow,
): LoyaltyMilestoneDefinition => ({
  id: asId<"LoyaltyMilestoneDefinitionId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  kind: row.kind,
  ...(row.custom_key ? { customKey: row.custom_key } : {}),
  label: row.label,
  explanation: row.explanation,
  points: row.points,
  matchConceptIds: (row.match_concept_ids ?? []).map((id) =>
    asId<"MetadataConceptId">(id),
  ),
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const milestoneAward = (row: MilestoneAwardRow): LoyaltyMilestoneAward => ({
  id: asId<"LoyaltyMilestoneAwardId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  customerId: asId<"CustomerId">(row.customer_id),
  loyaltyAccountId: asId<"LoyaltyAccountId">(row.loyalty_account_id),
  ...(row.definition_id
    ? { definitionId: asId<"LoyaltyMilestoneDefinitionId">(row.definition_id) }
    : {}),
  kind: row.kind,
  idempotencyKey: row.idempotency_key,
  ...(row.related_order_id
    ? { relatedOrderId: asId<"OrderId">(row.related_order_id) }
    : {}),
  ...(row.related_concept_id
    ? { relatedConceptId: asId<"MetadataConceptId">(row.related_concept_id) }
    : {}),
  points: row.points,
  status: row.status,
  ...(row.loyalty_ledger_entry_id
    ? {
        loyaltyLedgerEntryId: asId<"LoyaltyLedgerEntryId">(
          row.loyalty_ledger_entry_id,
        ),
      }
    : {}),
  ...(row.reverse_ledger_entry_id
    ? {
        reverseLedgerEntryId: asId<"LoyaltyLedgerEntryId">(
          row.reverse_ledger_entry_id,
        ),
      }
    : {}),
  label: row.label,
  explanation: row.explanation,
  awardedAt: row.awarded_at,
  ...(row.reversed_at ? { reversedAt: row.reversed_at } : {}),
});

export class LoyaltyRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findProgram(retailerId: RetailerId): Promise<LoyaltyProgram | null> {
    const { data, error } = await this.client
      .from("loyalty_programs")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? program(data) : null;
  }
  async saveProgram(
    retailerId: RetailerId,
    values: {
      name: string;
      enabled: boolean;
      pointsPerCurrencyUnit: number;
      referralPoints: number;
    },
  ): Promise<LoyaltyProgram> {
    const { data, error } = await this.client
      .from("loyalty_programs")
      .upsert(
        {
          retailer_id: retailerId,
          name: values.name,
          enabled: values.enabled,
          points_per_currency_unit: values.pointsPerCurrencyUnit,
          referral_points: values.referralPoints,
        },
        { onConflict: "retailer_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    await this.client.rpc("ensure_loyalty_milestone_definitions", {
      p_retailer_id: retailerId,
    });
    return program(data);
  }
  async findAccountByCustomer(
    customerId: CustomerId,
  ): Promise<LoyaltyAccount | null> {
    const { data, error } = await this.client
      .from("loyalty_accounts")
      .select("*")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? account(data) : null;
  }
  async findAccountsByRetailer(
    retailerId: RetailerId,
  ): Promise<LoyaltyAccount[]> {
    const { data, error } = await this.client
      .from("loyalty_accounts")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("points_balance", { ascending: false });
    if (error) throw error;
    return data.map(account);
  }
  async findLedger(accountId: LoyaltyAccountId): Promise<LoyaltyLedgerEntry[]> {
    const { data, error } = await this.client
      .from("loyalty_ledger_entries")
      .select("*")
      .eq("loyalty_account_id", accountId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(ledger);
  }
  async findRewards(retailerId: RetailerId): Promise<Reward[]> {
    const { data, error } = await this.client
      .from("rewards")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("points_cost");
    if (error) throw error;
    return data.map(reward);
  }
  async createReward(
    retailerId: RetailerId,
    values: {
      name: string;
      type: RewardType;
      pointsCost: number;
      minimumTier?: LoyaltyTier;
    },
  ): Promise<Reward> {
    const { data, error } = await this.client
      .from("rewards")
      .insert({
        retailer_id: retailerId,
        name: values.name,
        type: values.type,
        points_cost: values.pointsCost,
        minimum_tier: values.minimumTier ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return reward(data);
  }
  async findRedemptions(
    accountId: LoyaltyAccountId,
  ): Promise<RewardRedemption[]> {
    const { data, error } = await this.client
      .from("reward_redemptions")
      .select("*")
      .eq("loyalty_account_id", accountId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(redemption);
  }
  async findReferrals(customerId: CustomerId): Promise<Referral[]> {
    const { data, error } = await this.client
      .from("referrals")
      .select("*")
      .eq("referring_customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(referral);
  }
  async ensureMyAccount(retailerId: RetailerId): Promise<LoyaltyAccountId> {
    const { data, error } = await this.client.rpc("ensure_my_loyalty_account", {
      p_retailer_id: retailerId,
    });
    if (error) throw error;
    return asId<"LoyaltyAccountId">(data);
  }
  async createMyReferral(
    retailerId: RetailerId,
    referredEmail: string,
  ): Promise<void> {
    const { error } = await this.client.rpc("create_my_referral", {
      p_referred_email: referredEmail,
      p_retailer_id: retailerId,
    });
    if (error) throw error;
  }
  async redeemMyReward(rewardId: string): Promise<void> {
    const { error } = await this.client.rpc("redeem_my_reward", {
      p_reward_id: rewardId,
    });
    if (error) throw error;
  }

  async ensureMilestoneDefinitions(retailerId: RetailerId): Promise<void> {
    const { error } = await this.client.rpc(
      "ensure_loyalty_milestone_definitions",
      { p_retailer_id: retailerId },
    );
    if (error) throw error;
  }

  async findMilestoneDefinitions(
    retailerId: RetailerId,
  ): Promise<LoyaltyMilestoneDefinition[]> {
    await this.ensureMilestoneDefinitions(retailerId);
    const { data, error } = await this.client
      .from("loyalty_milestone_definitions")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("kind");
    if (error) throw error;
    return data.map(milestoneDefinition);
  }

  async upsertBuiltInMilestoneDefinition(
    retailerId: RetailerId,
    values: {
      kind: Exclude<LoyaltyMilestoneKind, "custom">;
      points: number;
      active: boolean;
      matchConceptIds?: readonly MetadataConceptId[];
    },
  ): Promise<LoyaltyMilestoneDefinition> {
    await this.ensureMilestoneDefinitions(retailerId);
    const existing = (await this.findMilestoneDefinitions(retailerId)).find(
      (definition) => definition.kind === values.kind,
    );
    if (!existing) {
      throw new Error(`Missing built-in milestone definition: ${values.kind}`);
    }
    const { data, error } = await this.client
      .from("loyalty_milestone_definitions")
      .update({
        points: values.points,
        active: values.active,
        match_concept_ids: [
          ...(values.matchConceptIds ?? existing.matchConceptIds),
        ],
      })
      .eq("id", existing.id)
      .eq("retailer_id", retailerId)
      .select("*")
      .single();
    if (error) throw error;
    return milestoneDefinition(data);
  }

  async createPeerMilestoneDefinition(
    retailerId: RetailerId,
    values: {
      customKey: string;
      label: string;
      explanation: string;
      points: number;
      matchConceptIds: readonly MetadataConceptId[];
      active: boolean;
    },
  ): Promise<LoyaltyMilestoneDefinition> {
    const { data, error } = await this.client
      .from("loyalty_milestone_definitions")
      .insert({
        retailer_id: retailerId,
        kind: "custom",
        custom_key: values.customKey,
        label: values.label,
        explanation: values.explanation,
        points: values.points,
        match_concept_ids: [...values.matchConceptIds],
        active: values.active,
      })
      .select("*")
      .single();
    if (error) throw error;
    return milestoneDefinition(data);
  }

  async findMilestoneAwardsForCustomer(
    customerId: CustomerId,
  ): Promise<LoyaltyMilestoneAward[]> {
    const { data, error } = await this.client
      .from("loyalty_milestone_awards")
      .select("*")
      .eq("customer_id", customerId)
      .order("awarded_at", { ascending: false });
    if (error) throw error;
    return data.map(milestoneAward);
  }

  async findMilestoneAwardsByStatus(
    customerId: CustomerId,
    status: LoyaltyMilestoneAwardStatus,
  ): Promise<LoyaltyMilestoneAward[]> {
    const { data, error } = await this.client
      .from("loyalty_milestone_awards")
      .select("*")
      .eq("customer_id", customerId)
      .eq("status", status)
      .order("awarded_at", { ascending: false });
    if (error) throw error;
    return data.map(milestoneAward);
  }

  async syncMilestonesForOrder(orderId: OrderId): Promise<number> {
    const { data, error } = await this.client.rpc(
      "sync_loyalty_milestones_for_order",
      { p_order_id: orderId },
    );
    if (error) throw error;
    return data ?? 0;
  }
}
