/**
 * StylePortraitConsent persistence (VWS-002 / PHASE 4.7 / ADR-074). Direct
 * RLS, no RPC — same "self, via exists against the owning table" shape as
 * `CustomerPreferencesRepository`.
 */

import {
  asId,
  type CustomerId,
  type ImageGenerationConsentStatus,
  type RetailerId,
  type StylePortraitConsent,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ConsentRow =
  Database["public"]["Tables"]["style_portrait_consents"]["Row"];

function toConsent(row: ConsentRow): StylePortraitConsent {
  return {
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    status: row.status as ImageGenerationConsentStatus,
    ...(row.granted_at ? { grantedAt: row.granted_at } : {}),
    ...(row.withdrawn_at ? { withdrawnAt: row.withdrawn_at } : {}),
    disclosuresAcknowledged: row.disclosures_acknowledged,
  };
}

const DEFAULT_CONSENT = (
  retailerId: RetailerId,
  customerId: CustomerId,
): StylePortraitConsent => ({
  retailerId,
  customerId,
  status: "denied",
  disclosuresAcknowledged: false,
});

export class StylePortraitConsentRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findForCustomer(
    retailerId: RetailerId,
    customerId: CustomerId,
  ): Promise<StylePortraitConsent> {
    const { data, error } = await this.client
      .from("style_portrait_consents")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle();
    if (error) throw error;
    return data ? toConsent(data) : DEFAULT_CONSENT(retailerId, customerId);
  }

  /** Explicit grant — the customer has just seen and acknowledged the
   * disclosures (why images are needed, advisor visibility, AI-only
   * output, deletion path). */
  async grant(
    retailerId: RetailerId,
    customerId: CustomerId,
  ): Promise<StylePortraitConsent> {
    const { data, error } = await this.client
      .from("style_portrait_consents")
      .upsert(
        {
          customer_id: customerId,
          retailer_id: retailerId,
          status: "granted",
          disclosures_acknowledged: true,
          granted_at: new Date().toISOString(),
          withdrawn_at: null,
        },
        { onConflict: "customer_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return toConsent(data);
  }

  /** Stops new use without erasing durable business records — same
   * withdrawal semantics as personalization consent. */
  async withdraw(
    retailerId: RetailerId,
    customerId: CustomerId,
  ): Promise<StylePortraitConsent> {
    const { data, error } = await this.client
      .from("style_portrait_consents")
      .upsert(
        {
          customer_id: customerId,
          retailer_id: retailerId,
          status: "withdrawn",
          withdrawn_at: new Date().toISOString(),
        },
        { onConflict: "customer_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return toConsent(data);
  }
}
