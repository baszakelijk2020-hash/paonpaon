/**
 * First-party interaction session persistence (CLI-001 / PHASE 7.2).
 */

import {
  asId,
  type CustomerId,
  type InteractionDeviceClass,
  type InteractionSession,
  type InteractionSessionState,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type Row = Database["public"]["Tables"]["interaction_sessions"]["Row"];

function toDomain(row: Row): InteractionSession {
  return {
    id: asId<"InteractionSessionId">(row.id),
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
    state: row.state as InteractionSessionState,
    startedAt: row.started_at,
    lastSeenAt: row.last_seen_at,
    ...(row.ended_at ? { endedAt: row.ended_at } : {}),
    deviceClass: row.device_class as InteractionDeviceClass,
    ...(row.locale ? { locale: row.locale } : {}),
    ...(row.timezone ? { timezone: row.timezone } : {}),
    ...(row.user_agent_class ? { userAgentClass: row.user_agent_class } : {}),
  };
}

export class InteractionSessionRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async ensureForCustomer(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly now?: string;
    readonly deviceClass?: InteractionDeviceClass;
    readonly locale?: string;
    readonly timezone?: string;
    readonly idleMinutes?: number;
  }): Promise<InteractionSession> {
    const now = args.now ?? new Date().toISOString();
    const { data, error } = await this.client.rpc(
      "ensure_interaction_session",
      {
        p_retailer_id: args.retailerId,
        p_customer_id: args.customerId,
        p_now: now,
        p_device_class: args.deviceClass ?? "unknown",
        ...(args.locale ? { p_locale: args.locale } : {}),
        ...(args.timezone ? { p_timezone: args.timezone } : {}),
        p_idle_minutes: args.idleMinutes ?? 30,
      },
    );
    if (error) throw error;

    const { data: row, error: loadError } = await this.client
      .from("interaction_sessions")
      .select("*")
      .eq("id", data)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!row) {
      throw new Error("Interaction session not found after ensure");
    }
    return toDomain(row);
  }

  async listRecentForRetailer(
    retailerId: RetailerId,
    sinceIso: string,
    limit = 100,
  ): Promise<InteractionSession[]> {
    const { data, error } = await this.client
      .from("interaction_sessions")
      .select("*")
      .eq("retailer_id", retailerId)
      .gte("last_seen_at", sinceIso)
      .order("last_seen_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }
}
