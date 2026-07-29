import {
  asId,
  assessCaptureEligibility,
  buildConsentSnapshot,
  buildLegacyConsentSnapshot,
  computeRetentionExpiresAt,
  isAdvisorVisibleEvent,
  type BehavioralEvent,
  type ConsentPurpose,
  type CustomerId,
  type InteractionEvent,
  type InteractionEventType,
  type RetentionClass,
  type RetailerId,
  toBehavioralEventName,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

import type { ConsentRepository } from "./consent-repository";

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

const toInteractionEvent = (row: Row): InteractionEvent => ({
  retailerId: asId<"RetailerId">(row.retailer_id),
  ...(row.customer_id
    ? { customerId: asId<"CustomerId">(row.customer_id) }
    : {}),
  ...(row.anonymous_session_id
    ? { anonymousSessionId: row.anonymous_session_id }
    : {}),
  interactionType: row.interaction_type as InteractionEventType,
  purpose: row.purpose as ConsentPurpose,
  consentSnapshot:
    row.consent_snapshot as unknown as InteractionEvent["consentSnapshot"],
  retentionClass: row.retention_class as RetentionClass,
  ...(row.retention_expires_at
    ? { retentionExpiresAt: row.retention_expires_at }
    : {}),
  ...(row.anonymized_at ? { anonymizedAt: row.anonymized_at } : {}),
  properties: row.properties as Record<string, unknown>,
  occurredAt: row.occurred_at,
  source: row.source as InteractionEvent["source"],
});

const toDomain = (row: Row): BehavioralEvent => {
  const event = toInteractionEvent(row);
  return {
    ...event,
    name: toBehavioralEventName(event.interactionType),
  };
};

export class AnalyticsRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async capture(event: InteractionEvent): Promise<string> {
    const retentionExpiresAt =
      event.retentionExpiresAt ??
      computeRetentionExpiresAt(event.retentionClass, event.occurredAt);

    const { data, error } = await this.client.rpc("capture_behavioral_event", {
      p_retailer_id: event.retailerId,
      p_interaction_type: event.interactionType,
      p_properties: event.properties as Json,
      p_source: event.source,
      ...(event.customerId ? { p_customer_id: event.customerId } : {}),
      p_occurred_at: event.occurredAt,
      p_purpose: event.purpose,
      p_consent_snapshot: event.consentSnapshot as unknown as Json,
      p_retention_class: event.retentionClass,
      p_retention_expires_at: retentionExpiresAt,
      ...(event.anonymousSessionId
        ? { p_anonymous_session_id: event.anonymousSessionId }
        : {}),
    });
    if (error) throw error;
    return data;
  }

  async captureWithConsent(
    event: Omit<
      InteractionEvent,
      "consentSnapshot" | "retentionClass" | "retentionExpiresAt" | "purpose"
    > & {
      purpose?: ConsentPurpose;
      retentionClass?: RetentionClass;
    },
    consentRepo: ConsentRepository,
  ): Promise<string | null> {
    if (!event.customerId) return null;

    const records = await consentRepo.findByCustomer(
      event.retailerId,
      event.customerId,
    );
    const purpose = event.purpose ?? "personalization";
    const capturedAt = event.occurredAt;
    const eligibility = assessCaptureEligibility({
      interactionType: event.interactionType,
      consentRecords: records,
      capturedAt,
    });
    if (!eligibility.allowed || !eligibility.consentSnapshot) {
      return null;
    }

    return this.capture({
      ...event,
      purpose,
      consentSnapshot: eligibility.consentSnapshot,
      retentionClass: event.retentionClass ?? "personalization_standard",
      retentionExpiresAt: computeRetentionExpiresAt(
        event.retentionClass ?? "personalization_standard",
        capturedAt,
      ),
    });
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

  /** Scoped to one customer — the context AI personalisation builds from. */
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
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }

  /** Advisor-safe projection: consented, non-anonymized, within retention. */
  async findRecentByCustomerForAdvisor(
    retailerId: RetailerId,
    customerId: CustomerId,
    consentRepo: ConsentRepository,
    limit = 20,
  ): Promise<BehavioralEvent[]> {
    const [events, consentRecords] = await Promise.all([
      this.findRecentByCustomer(retailerId, customerId, limit),
      consentRepo.findByCustomer(retailerId, customerId),
    ]);
    const nowIso = new Date().toISOString();
    return events.filter((event) =>
      isAdvisorVisibleEvent(event, consentRecords, nowIso),
    );
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

export { buildLegacyConsentSnapshot, buildConsentSnapshot };
