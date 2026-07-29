import type {
  CustomerId,
  LoyaltyAccountId,
  LoyaltyLedgerEntryId,
  LoyaltyProgramId,
  ReferralId,
  RetailerId,
  RewardId,
  RewardRedemptionId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type LoyaltyTier = "member" | "silver" | "gold" | "platinum";

export interface LoyaltyProgram extends Timestamps {
  readonly id: LoyaltyProgramId;
  readonly retailerId: RetailerId;
  readonly name: string;
  readonly enabled: boolean;
  readonly pointsPerCurrencyUnit: number;
  readonly referralPoints: number;
}

export interface LoyaltyAccount extends Timestamps {
  readonly id: LoyaltyAccountId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly tier: LoyaltyTier;
  readonly pointsBalance: number;
  readonly lifetimePoints: number;
  readonly tierAnniversaryAt?: string;
}

export type LoyaltyLedgerEntryType =
  | "earn_purchase"
  | "earn_referral"
  | "earn_bonus"
  | "redeem_reward"
  | "adjustment_expiry"
  | "adjustment_manual";

/** Append-only ledger. Balance is always derived, never mutated directly. */
export interface LoyaltyLedgerEntry {
  readonly id: LoyaltyLedgerEntryId;
  readonly loyaltyAccountId: LoyaltyAccountId;
  readonly type: LoyaltyLedgerEntryType;
  readonly points: number;
  readonly relatedOrderId?: string;
  readonly note?: string;
  readonly createdAt: string;
}

export type RewardType =
  "discount_percent" | "discount_fixed" | "gift" | "early_access";

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  discount_percent: "Percentage discount",
  discount_fixed: "Fixed discount",
  gift: "Gift",
  early_access: "Early access",
};

export interface Reward extends Timestamps {
  readonly id: RewardId;
  readonly retailerId: RetailerId;
  readonly name: string;
  readonly type: RewardType;
  readonly pointsCost: number;
  readonly minimumTier?: LoyaltyTier;
  readonly active: boolean;
}

export interface RewardRedemption {
  readonly id: RewardRedemptionId;
  readonly loyaltyAccountId: LoyaltyAccountId;
  readonly rewardId: RewardId;
  readonly pointsSpent: number;
  readonly status: "issued" | "used" | "cancelled";
  readonly code: string;
  readonly createdAt: string;
  readonly usedAt?: string;
}

export type ReferralStatus =
  "invited" | "signed_up" | "first_purchase_completed" | "rewarded";

export interface Referral extends Timestamps {
  readonly id: ReferralId;
  readonly retailerId: RetailerId;
  readonly referringCustomerId: CustomerId;
  readonly referredEmail: string;
  readonly code: string;
  readonly referredCustomerId?: CustomerId;
  readonly status: ReferralStatus;
  readonly rewardId?: RewardId;
}
