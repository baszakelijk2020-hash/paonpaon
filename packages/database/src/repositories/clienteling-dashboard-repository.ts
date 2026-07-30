/**
 * Clienteling dashboard projection (CLI-008 / PHASE 7.7).
 */

import {
  DEFAULT_PRESENCE_TTL_MS,
  DASHBOARD_PROJECTOR_VERSION,
  projectCustomerPresence,
  projectDashboardOutcomeFunnel,
  projectHourlyHeatmap,
  projectOpportunityFunnel,
  type ClientelingDashboardProjection,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

import { AnalyticsRepository } from "./analytics-repository";
import { ClientelingOpportunityRepository } from "./clienteling-opportunity-repository";
import { InteractionSessionRepository } from "./interaction-session-repository";

export class ClientelingDashboardRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async projectForRetailer(args: {
    readonly retailerId: RetailerId;
    readonly now?: string;
    readonly timezone?: string;
  }): Promise<ClientelingDashboardProjection> {
    const now = args.now ?? new Date().toISOString();
    const since = new Date(
      Date.parse(now) - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const timeZone = args.timezone ?? "UTC";

    const [sessions, opportunities, recentEvents] = await Promise.all([
      new InteractionSessionRepository(this.client).listRecentForRetailer(
        args.retailerId,
        new Date(Date.parse(now) - 24 * 60 * 60 * 1000).toISOString(),
        80,
      ),
      new ClientelingOpportunityRepository(this.client).listForRetailer(
        args.retailerId,
        200,
      ),
      new AnalyticsRepository(this.client).findRecent(args.retailerId, 300),
    ]);

    const sinceMs = Date.parse(since);
    const localHours = recentEvents
      .filter((event) => Date.parse(event.occurredAt) >= sinceMs)
      .map((event) => {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone,
          hour: "numeric",
          hourCycle: "h23",
        }).formatToParts(new Date(event.occurredAt));
        return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
      });

    return {
      retailerId: args.retailerId,
      generatedAt: now,
      projectorVersion: DASHBOARD_PROJECTOR_VERSION,
      presenceTtlMs: DEFAULT_PRESENCE_TTL_MS,
      presence: projectCustomerPresence({
        now,
        sessions: sessions.map((session) => ({
          ...(session.customerId ? { customerId: session.customerId } : {}),
          lastSeenAt: session.lastSeenAt,
          state: session.state,
        })),
      }),
      opportunityFunnel: projectOpportunityFunnel(opportunities),
      outcomeFunnel: projectDashboardOutcomeFunnel(opportunities),
      hourlyHeatmap: projectHourlyHeatmap(localHours),
    };
  }
}
