import type {
  RetailerId,
  SubscriptionId,
  SubscriptionPlanId,
} from "../shared/branded-id";
import type { Money } from "../shared/money";
import type { Timestamps } from "../shared/timestamps";

export type BillingInterval = "monthly" | "annual";

export type SubscriptionStatus =
  "trialing" | "active" | "past_due" | "canceled";

export interface SubscriptionPlan extends Timestamps {
  readonly id: SubscriptionPlanId;
  readonly key: string;
  readonly name: string;
  readonly price: Money;
  readonly billingInterval: BillingInterval;
  readonly includedFeatureKeys: readonly string[];
  readonly seatLimit?: number;
}

/** A retailer's active commercial relationship with PAON. Owned by PAON Admin. */
export interface RetailerSubscription extends Timestamps {
  readonly id: SubscriptionId;
  readonly retailerId: RetailerId;
  readonly planId: SubscriptionPlanId;
  readonly status: SubscriptionStatus;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly trialEndsAt?: string;
  readonly cancelAtPeriodEnd: boolean;
}

/** Per-retailer feature toggles, layered on top of the plan's included features. */
export interface FeatureFlagOverride {
  readonly retailerId: RetailerId;
  readonly featureKey: string;
  readonly enabled: boolean;
  readonly reason?: string;
}
