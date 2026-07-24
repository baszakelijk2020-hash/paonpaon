import {
  asId,
  type CommercialFeature,
  type CommercialFeatureKey,
  type CurrencyCode,
  type ManagedServiceOffering,
  type SubscriptionPlan,
  type SubscriptionPlanId,
  type UpdateCommercialPlanInput,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type SubscriptionPlanRow =
  Database["public"]["Tables"]["subscription_plans"]["Row"];
type CommercialFeatureRow =
  Database["public"]["Tables"]["commercial_features"]["Row"];
type ManagedServiceRow =
  Database["public"]["Tables"]["managed_service_offerings"]["Row"];

function toDomain(row: SubscriptionPlanRow): SubscriptionPlan {
  return {
    id: asId<"SubscriptionPlanId">(row.id),
    key: row.key,
    name: row.name,
    price: {
      amountMinorUnits: row.price_amount_minor_units,
      currency: row.price_currency as CurrencyCode,
    },
    priceIsFrom: row.price_is_from,
    billingInterval:
      row.billing_interval as SubscriptionPlan["billingInterval"],
    positioning: row.positioning,
    description: row.description,
    implementationFee: {
      amountMinorUnits: row.implementation_fee_amount_minor_units,
      currency: row.implementation_fee_currency as CurrencyCode,
    },
    includedFeatureKeys: row.included_feature_keys as CommercialFeatureKey[],
    isPublic: row.is_public,
    displayOrder: row.display_order,
    ...(row.seat_limit !== null ? { seatLimit: row.seat_limit } : {}),
    ...(row.provider_price_id
      ? { providerPriceId: row.provider_price_id }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function featureToDomain(row: CommercialFeatureRow): CommercialFeature {
  return {
    key: row.key as CommercialFeatureKey,
    name: row.name,
    description: row.description,
    category: row.category as CommercialFeature["category"],
    displayOrder: row.display_order,
  };
}

function serviceToDomain(row: ManagedServiceRow): ManagedServiceOffering {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    ...(row.price_amount_minor_units !== null && row.price_currency
      ? {
          price: {
            amountMinorUnits: row.price_amount_minor_units,
            currency: row.price_currency as CurrencyCode,
          },
        }
      : {}),
    ...(row.billing_interval
      ? {
          billingInterval: row.billing_interval as NonNullable<
            ManagedServiceOffering["billingInterval"]
          >,
        }
      : {}),
    priceIsFrom: row.price_is_from,
    isPublic: row.is_public,
    displayOrder: row.display_order,
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
      .order("display_order", { ascending: true });
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

  /** Platform-staff-only atomic commercial catalogue update. */
  async updateCommercialPlan(input: UpdateCommercialPlanInput): Promise<void> {
    const { error } = await this.client.rpc("update_commercial_plan", {
      p_plan_id: input.planId,
      p_name: input.name,
      p_positioning: input.positioning,
      p_description: input.description,
      p_price_amount_minor_units: input.priceAmountMinorUnits,
      p_price_currency: input.priceCurrency,
      p_price_is_from: input.priceIsFrom,
      p_implementation_fee_amount_minor_units:
        input.implementationFeeAmountMinorUnits,
      p_implementation_fee_currency: input.implementationFeeCurrency,
      p_seat_limit: (input.seatLimit ?? null) as never,
      p_feature_keys: input.includedFeatureKeys,
      p_is_public: input.isPublic,
    });
    if (error) throw error;
  }

  async findCommercialFeatures(): Promise<CommercialFeature[]> {
    const { data, error } = await this.client
      .from("commercial_features")
      .select("*")
      .order("display_order", { ascending: true });
    if (error) throw error;
    return data.map(featureToDomain);
  }

  async findManagedServices(): Promise<ManagedServiceOffering[]> {
    const { data, error } = await this.client
      .from("managed_service_offerings")
      .select("*")
      .order("display_order", { ascending: true });
    if (error) throw error;
    return data.map(serviceToDomain);
  }
}
