import {
  asId,
  parseConsentSnapshot,
  type BehavioralEvent,
  type ConsentBasis,
  type ConsentPurpose,
  type CustomerId,
  type InteractionEventName,
  type InteractionEventSource,
  type RetentionClass,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type Row = Database["public"]["Tables"]["behavioral_events"]["Row"];

export interface RetailerAnalytics {
  customers: number;
  newCustomers: number;
  orders: number;
  revenueMinorUnits: number;
  appointments: number;
  openAlterations: number;
  eventRsvps: number;
  messages: number;
  behavioralEvents: number;
}

export interface PlatformAnalytics {
  retailers: number;
  activeRetailers: number;
  newRetailers: number;
  customers: number;
  newCustomers: number;
  orders: number;
  grossMerchandiseValueByCurrency: Record<string, number>;
  appointments: number;
  openAlterations: number;
  messages: number;
  behavioralEvents: number;
}

const toDomain = (row: Row): BehavioralEvent => ({
  id: asId<"BehavioralEventId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  ...(row.customer_id
    ? { customerId: asId<"CustomerId">(row.customer_id) }
    : {}),
  ...(row.anonymous_session_id
    ? {
        anonymousSessionId: asId<"AnonymousSessionId">(
          row.anonymous_session_id,
        ),
      }
    : {}),
  name: row.name as InteractionEventName,
  properties: row.properties as Record<string, unknown>,
  occurredAt: row.occurred_at,
  source: row.source as InteractionEventSource,
  purpose: row.purpose as ConsentPurpose,
  consentBasis: row.consent_basis as ConsentBasis,
  consentSnapshot: parseConsentSnapshot(row.consent_snapshot),
  retentionClass: row.retention_class as RetentionClass,
  retentionExpiresAt: row.retention_expires_at,
  ...(row.anonymized_at ? { anonymizedAt: row.anonymized_at } : {}),
});

export class AnalyticsRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async capture(event: BehavioralEvent): Promise<string> {
    const { data, error } = await this.client.rpc("capture_behavioral_event", {
      p_retailer_id: event.retailerId,
      p_name: event.name,
      p_properties: event.properties as Json,
      p_source: event.source,
      ...(event.customerId ? { p_customer_id: event.customerId } : {}),
      p_occurred_at: event.occurredAt,
      p_purpose: event.purpose,
      p_consent_basis: event.consentBasis,
      p_consent_snapshot: event.consentSnapshot as unknown as Json,
      p_retention_class: event.retentionClass,
      p_retention_expires_at: event.retentionExpiresAt,
      ...(event.anonymousSessionId
        ? { p_anonymous_session_id: event.anonymousSessionId }
        : {}),
    });
    if (error) throw error;
    return data;
  }

  async findRecent(
    retailerId: RetailerId,
    limit = 100,
  ): Promise<BehavioralEvent[]> {
    const { data, error } = await this.client
      .from("behavioral_events")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }

  /**
   * Advisor/customer-visible personalization signals: same retailer,
   * still linked to the customer, not anonymized, and not past retention.
   */
  async findRecentByCustomer(
    retailerId: RetailerId,
    customerId: CustomerId,
    limit = 20,
  ): Promise<BehavioralEvent[]> {
    const { data, error } = await this.client
      .from("behavioral_events")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .is("anonymized_at", null)
      .gt("retention_expires_at", new Date().toISOString())
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }

  async summary(
    retailerId: RetailerId,
    since: string,
  ): Promise<RetailerAnalytics> {
    const { data, error } = await this.client.rpc("get_retailer_analytics", {
      p_retailer_id: retailerId,
      p_since: since,
    });
    if (error) throw error;
    return data as unknown as RetailerAnalytics;
  }

  async platformSummary(since: string): Promise<PlatformAnalytics> {
    const { data, error } = await this.client.rpc("get_platform_analytics", {
      p_since: since,
    });
    if (error) throw error;
    return data as unknown as PlatformAnalytics;
  }
}
