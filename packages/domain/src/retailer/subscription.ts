import type {
  RetailerId,
  SubscriptionId,
  SubscriptionPlanId,
} from "../shared/branded-id";
import type { Money } from "../shared/money";
import type { Timestamps } from "../shared/timestamps";

export type BillingInterval = "monthly" | "annual";

export const COMMERCIAL_FEATURE_KEYS = [
  "branded_website",
  "customer_accounts",
  "crm",
  "catalogue",
  "appointments",
  "order_tracking",
  "alterations_core",
  "analytics_basic",
  "ecommerce",
  "loyalty",
  "referrals",
  "vouchers",
  "events",
  "wedding_planning",
  "clienteling",
  "messaging",
  "alterations_advanced",
  "analytics_expanded",
  "multi_user",
  "multi_location",
  "bespoke_implementation",
  "analytics_advanced",
  "ai_personalisation",
  "custom_integrations",
  "campaign_support",
  "lead_generation",
  "management_consulting",
  "priority_support",
  "quarterly_growth_planning",
] as const;

export type CommercialFeatureKey = (typeof COMMERCIAL_FEATURE_KEYS)[number];
export type CommercialFeatureCategory =
  | "foundation"
  | "commerce"
  | "engagement"
  | "operations"
  | "intelligence"
  | "service";

export interface CommercialFeature {
  readonly key: CommercialFeatureKey;
  readonly name: string;
  readonly description: string;
  readonly category: CommercialFeatureCategory;
  readonly displayOrder: number;
}

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

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Past due",
  canceled: "Cancelled",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  unpaid: "Unpaid",
  paused: "Paused",
};

export interface SubscriptionPlan extends Timestamps {
  readonly id: SubscriptionPlanId;
  readonly key: string;
  readonly name: string;
  readonly price: Money;
  readonly priceIsFrom: boolean;
  readonly billingInterval: BillingInterval;
  readonly positioning: string;
  readonly description: string;
  readonly implementationFee: Money;
  readonly includedFeatureKeys: readonly CommercialFeatureKey[];
  readonly isPublic: boolean;
  readonly displayOrder: number;
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

/** A time-bounded exception layered over the subscribed plan. */
export interface FeatureFlagOverride {
  readonly retailerId: RetailerId;
  readonly featureKey: CommercialFeatureKey;
  readonly enabled: boolean;
  readonly reason?: string;
  readonly expiresAt?: string;
}

export type ManagedServiceBillingInterval =
  "one_time" | "monthly" | "quarterly";

/** Optional human service; deliberately not a software subscription line. */
export interface ManagedServiceOffering extends Timestamps {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly price?: Money;
  readonly billingInterval?: ManagedServiceBillingInterval;
  readonly priceIsFrom: boolean;
  readonly isPublic: boolean;
  readonly displayOrder: number;
}
