import {
  asId,
  type CustomerId,
  type LoyaltyAccount,
  type LoyaltyAccountId,
  type LoyaltyLedgerEntry,
  type LoyaltyProgram,
  type LoyaltyTier,
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
}
