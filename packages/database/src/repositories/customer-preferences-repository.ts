import {
  asId,
  type CustomerId,
  type CustomerPreferences,
  type UpsertCustomerPreferencesInput,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type CustomerPreferencesRow =
  Database["public"]["Tables"]["customer_preferences"]["Row"];

function toDomain(row: CustomerPreferencesRow): CustomerPreferences {
  return {
    customerId: asId<"CustomerId">(row.customer_id),
    preferredLocale: row.preferred_locale,
    preferredCurrency: row.preferred_currency,
    communicationChannels:
      row.communication_channels as CustomerPreferences["communicationChannels"],
    ...(row.style_notes ? { styleNotes: row.style_notes } : {}),
    marketingOptIn: row.marketing_opt_in,
    personalizationOptIn: row.personalization_opt_in,
    locationOptIn: row.location_opt_in,
    ...(row.personalization_withdrawn_at
      ? { personalizationWithdrawnAt: row.personalization_withdrawn_at }
      : {}),
    ...(row.marketing_withdrawn_at
      ? { marketingWithdrawnAt: row.marketing_withdrawn_at }
      : {}),
    ...(row.location_withdrawn_at
      ? { locationWithdrawnAt: row.location_withdrawn_at }
      : {}),
  };
}

/** See `docs/ARCHITECTURE.md` "Data access layer" — this repository is the only code allowed to query `customer_preferences`. */
export class CustomerPreferencesRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByCustomer(
    customerId: CustomerId,
  ): Promise<CustomerPreferences | null> {
    const { data, error } = await this.client
      .from("customer_preferences")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async upsert(
    customerId: CustomerId,
    input: UpsertCustomerPreferencesInput,
  ): Promise<CustomerPreferences> {
    const { data, error } = await this.client
      .from("customer_preferences")
      .upsert(
        {
          customer_id: customerId,
          preferred_locale: input.preferredLocale,
          preferred_currency: input.preferredCurrency,
          communication_channels: input.communicationChannels,
          style_notes: input.styleNotes ?? null,
          // Consent purpose flags are owned by set_customer_consent (ADR-061).
          // Keep writing marketing_opt_in for backward-compatible first saves
          // when the consent RPC has not yet created a row.
          marketing_opt_in: input.marketingOptIn,
          personalization_opt_in: input.personalizationOptIn,
          location_opt_in: input.locationOptIn,
        },
        { onConflict: "customer_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }
}
