import { asId, type BehavioralEvent, type RetailerId } from "@paon/domain";

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

const toDomain = (row: Row): BehavioralEvent => ({
  retailerId: asId<"RetailerId">(row.retailer_id),
  ...(row.customer_id
    ? { customerId: asId<"CustomerId">(row.customer_id) }
    : {}),
  name: row.name,
  properties: row.properties as Record<string, unknown>,
  occurredAt: row.occurred_at,
  source: row.source as BehavioralEvent["source"],
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
}
