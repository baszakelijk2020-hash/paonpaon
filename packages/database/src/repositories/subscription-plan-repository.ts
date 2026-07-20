import {
  asId,
  type CurrencyCode,
  type SubscriptionPlan,
  type SubscriptionPlanId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type SubscriptionPlanRow =
  Database["public"]["Tables"]["subscription_plans"]["Row"];

function toDomain(row: SubscriptionPlanRow): SubscriptionPlan {
  return {
    id: asId<"SubscriptionPlanId">(row.id),
    key: row.key,
    name: row.name,
    price: {
      amountMinorUnits: row.price_amount_minor_units,
      currency: row.price_currency as CurrencyCode,
    },
    billingInterval:
      row.billing_interval as SubscriptionPlan["billingInterval"],
    includedFeatureKeys: row.included_feature_keys,
    ...(row.seat_limit !== null ? { seatLimit: row.seat_limit } : {}),
    ...(row.provider_price_id
      ? { providerPriceId: row.provider_price_id }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** See `docs/ARCHITECTURE.md` "Data access layer" — this repository is the only code allowed to query `subscription_plans`. */
export class SubscriptionPlanRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findAll(): Promise<SubscriptionPlan[]> {
    const { data, error } = await this.client
      .from("subscription_plans")
      .select("*")
      .order("price_amount_minor_units", { ascending: true });
    if (error) throw error;
    return data.map(toDomain);
  }

  async findById(id: SubscriptionPlanId): Promise<SubscriptionPlan | null> {
    const { data, error } = await this.client
      .from("subscription_plans")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  /** Platform-staff-only — see `SubscriptionPlan.providerPriceId`. */
  async updateProviderPriceId(
    id: SubscriptionPlanId,
    providerPriceId: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("subscription_plans")
      .update({ provider_price_id: providerPriceId })
      .eq("id", id);
    if (error) throw error;
  }
}
