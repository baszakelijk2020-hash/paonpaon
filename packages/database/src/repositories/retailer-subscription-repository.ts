import {
  asId,
  type RetailerId,
  type RetailerSubscription,
  type SubscriptionPlanId,
  type SubscriptionStatus,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type RetailerSubscriptionRow =
  Database["public"]["Tables"]["retailer_subscriptions"]["Row"];

function toDomain(row: RetailerSubscriptionRow): RetailerSubscription {
  return {
    id: asId<"SubscriptionId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    planId: asId<"SubscriptionPlanId">(row.plan_id),
    status: row.status,
    ...(row.current_period_start
      ? { currentPeriodStart: row.current_period_start }
      : {}),
    ...(row.current_period_end
      ? { currentPeriodEnd: row.current_period_end }
      : {}),
    ...(row.trial_ends_at ? { trialEndsAt: row.trial_ends_at } : {}),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    ...(row.provider_customer_id
      ? { providerCustomerId: row.provider_customer_id }
      : {}),
    ...(row.provider_subscription_id
      ? { providerSubscriptionId: row.provider_subscription_id }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateRetailerSubscriptionParams {
  retailerId: RetailerId;
  planId: SubscriptionPlanId;
  providerCustomerId: string;
  providerSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string;
}

/** See `docs/ARCHITECTURE.md` "Data access layer" — this repository is the only code allowed to query `retailer_subscriptions`. */
export class RetailerSubscriptionRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByRetailer(
    retailerId: RetailerId,
  ): Promise<RetailerSubscription | null> {
    const { data, error } = await this.client
      .from("retailer_subscriptions")
      .select("*")
      .eq("retailer_id", retailerId)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  /** Platform-staff-initiated, right after the real Stripe Customer/Subscription are created — see PAON Admin's `assignSubscriptionPlan` action. */
  async create(
    params: CreateRetailerSubscriptionParams,
  ): Promise<RetailerSubscription> {
    const { data, error } = await this.client
      .from("retailer_subscriptions")
      .insert({
        retailer_id: params.retailerId,
        plan_id: params.planId,
        provider_customer_id: params.providerCustomerId,
        provider_subscription_id: params.providerSubscriptionId,
        status: params.status,
        current_period_start: params.currentPeriodStart ?? null,
        current_period_end: params.currentPeriodEnd ?? null,
        cancel_at_period_end: params.cancelAtPeriodEnd,
        trial_ends_at: params.trialEndsAt ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }

  /** Platform-operator-initiated plan change — mirrors the Stripe subscription update already applied in `changeSubscriptionPlan`. */
  async updatePlan(
    retailerId: RetailerId,
    params: {
      planId: SubscriptionPlanId;
      status: SubscriptionStatus;
      currentPeriodStart?: string;
      currentPeriodEnd?: string;
      cancelAtPeriodEnd: boolean;
    },
  ): Promise<void> {
    const { error } = await this.client
      .from("retailer_subscriptions")
      .update({
        plan_id: params.planId,
        status: params.status,
        current_period_start: params.currentPeriodStart ?? null,
        current_period_end: params.currentPeriodEnd ?? null,
        cancel_at_period_end: params.cancelAtPeriodEnd,
      })
      .eq("retailer_id", retailerId);
    if (error) throw error;
  }

  /** Platform-operator-initiated cancellation, applied right after the real Stripe subscription is cancelled. */
  async markCanceled(retailerId: RetailerId): Promise<void> {
    const { error } = await this.client
      .from("retailer_subscriptions")
      .update({ status: "canceled", cancel_at_period_end: true })
      .eq("retailer_id", retailerId);
    if (error) throw error;
  }

  /** Service-role only, driven by `customer.subscription.updated`/`.deleted` — never client-triggered. */
  async syncFromWebhook(
    providerSubscriptionId: string,
    status: {
      status: SubscriptionStatus;
      currentPeriodStart?: string;
      currentPeriodEnd?: string;
      cancelAtPeriodEnd: boolean;
      trialEndsAt?: string;
    },
  ): Promise<void> {
    const { error } = await this.client
      .from("retailer_subscriptions")
      .update({
        status: status.status,
        current_period_start: status.currentPeriodStart ?? null,
        current_period_end: status.currentPeriodEnd ?? null,
        cancel_at_period_end: status.cancelAtPeriodEnd,
        trial_ends_at: status.trialEndsAt ?? null,
      })
      .eq("provider_subscription_id", providerSubscriptionId);
    if (error) throw error;
  }
}
