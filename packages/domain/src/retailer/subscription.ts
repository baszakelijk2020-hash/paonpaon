import type {
  RetailerId,
  SubscriptionId,
  SubscriptionPlanId,
} from "../shared/branded-id";
import type { Money } from "../shared/money";
import type { Timestamps } from "../shared/timestamps";

export type BillingInterval = "monthly" | "annual";

/** Mirrors Stripe's own `Subscription.status` values — PAON Billing has one provider, Stripe (founder decision), so there's no reason to model a narrower business-level enum and translate at every boundary. */
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export interface SubscriptionPlan extends Timestamps {
  readonly id: SubscriptionPlanId;
  readonly key: string;
  readonly name: string;
  readonly price: Money;
  readonly billingInterval: BillingInterval;
  readonly includedFeatureKeys: readonly string[];
  readonly seatLimit?: number;
  /** The Stripe Price this plan bills against — absent until a platform operator creates the real Price in the Stripe dashboard and records its id here (see docs/PROJECT_STATE.md "Credentials needed"). A retailer cannot be subscribed to a plan with no price yet. */
  readonly providerPriceId?: string;
}

/** A retailer's active commercial relationship with PAON. Owned by PAON Admin — see docs/DECISIONS.md ADR-031. */
export interface RetailerSubscription extends Timestamps {
  readonly id: SubscriptionId;
  readonly retailerId: RetailerId;
  readonly planId: SubscriptionPlanId;
  readonly status: SubscriptionStatus;
  readonly currentPeriodStart?: string;
  readonly currentPeriodEnd?: string;
  readonly trialEndsAt?: string;
  readonly cancelAtPeriodEnd: boolean;
  readonly providerCustomerId?: string;
  readonly providerSubscriptionId?: string;
}

/** Per-retailer feature toggles, layered on top of the plan's included features. */
export interface FeatureFlagOverride {
  readonly retailerId: RetailerId;
  readonly featureKey: string;
  readonly enabled: boolean;
  readonly reason?: string;
}
