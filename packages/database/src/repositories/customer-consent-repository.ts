import {
  asId,
  buildConsentSnapshot,
  purposeConsentStatus,
  type BehavioralEvent,
  type ConsentSnapshot,
  type ConsentStatus,
  type CustomerConsentEvent,
  type CustomerConsentState,
  type CustomerId,
  type InteractionEventName,
  type RetailerId,
  type SetCustomerConsentInput,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PreferencesRow =
  Database["public"]["Tables"]["customer_preferences"]["Row"];
type ConsentEventRow =
  Database["public"]["Tables"]["customer_consent_events"]["Row"];

function purposeState(
  purpose: "personalization" | "marketing" | "location",
  optIn: boolean,
  withdrawnAt: string | null,
): CustomerConsentState["personalization"] {
  const status = purposeConsentStatus({ optIn, withdrawnAt });
  return {
    purpose,
    status,
    ...(withdrawnAt ? { withdrawnAt } : {}),
  };
}

function toConsentState(
  retailerId: RetailerId,
  customerId: CustomerId,
  row: PreferencesRow | null,
  updatedAt: string,
): CustomerConsentState {
  return {
    retailerId,
    customerId,
    personalization: purposeState(
      "personalization",
      row?.personalization_opt_in ?? false,
      row?.personalization_withdrawn_at ?? null,
    ),
    marketing: purposeState(
      "marketing",
      row?.marketing_opt_in ?? false,
      row?.marketing_withdrawn_at ?? null,
    ),
    location: purposeState(
      "location",
      row?.location_opt_in ?? false,
      row?.location_withdrawn_at ?? null,
    ),
    updatedAt: row?.updated_at ?? updatedAt,
  };
}

function toConsentEvent(row: ConsentEventRow): CustomerConsentEvent {
  return {
    id: asId<"CustomerConsentEventId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    purpose: row.purpose as CustomerConsentEvent["purpose"],
    status: row.status as ConsentStatus,
    ...(row.previous_status
      ? { previousStatus: row.previous_status as ConsentStatus }
      : {}),
    ...(row.actor_user_id
      ? { actorUserId: asId<"UserId">(row.actor_user_id) }
      : {}),
    ...(row.reason ? { reason: row.reason } : {}),
    createdAt: row.created_at,
  };
}

/** Purpose-specific consent reads/writes for intelligence (ADR-061). */
export class CustomerConsentRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async getState(
    retailerId: RetailerId,
    customerId: CustomerId,
  ): Promise<CustomerConsentState> {
    const { data, error } = await this.client
      .from("customer_preferences")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle();
    if (error) throw error;
    return toConsentState(
      retailerId,
      customerId,
      data,
      new Date().toISOString(),
    );
  }

  async snapshotForCapture(
    retailerId: RetailerId,
    customerId: CustomerId,
    capturedAt = new Date().toISOString(),
  ): Promise<ConsentSnapshot> {
    const state = await this.getState(retailerId, customerId);
    return buildConsentSnapshot({
      state,
      basis:
        state.personalization.status === "granted"
          ? "explicit_opt_in"
          : "explicit_opt_out",
      capturedAt,
    });
  }

  async setConsent(
    customerId: CustomerId,
    input: SetCustomerConsentInput,
  ): Promise<void> {
    const { error } = await this.client.rpc("set_customer_consent", {
      p_customer_id: customerId,
      p_purpose: input.purpose,
      p_status: input.status,
      ...(input.reason ? { p_reason: input.reason } : {}),
    });
    if (error) throw error;
  }

  async listHistory(
    customerId: CustomerId,
    limit = 50,
  ): Promise<CustomerConsentEvent[]> {
    const { data, error } = await this.client
      .from("customer_consent_events")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toConsentEvent);
  }
}

export type { BehavioralEvent, InteractionEventName };
