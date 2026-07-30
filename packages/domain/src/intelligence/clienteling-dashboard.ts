/**
 * Live/temporal dashboard projections (CLI-008 / PHASE 7.7 / ADR-066).
 * Presence never implies online after heartbeat TTL expiry.
 */

import type { CustomerId, RetailerId, StaffId } from "../shared/branded-id";

import type { ClientelingOpportunityStatus } from "./clienteling-opportunity";

export const DASHBOARD_PROJECTOR_VERSION = "clienteling-dashboard-v1";

/** Heartbeat/presence TTL — after this, show last-seen, not "online". */
export const DEFAULT_PRESENCE_TTL_MS = 2 * 60 * 1000;

export interface PresenceSessionInput {
  readonly customerId?: CustomerId;
  readonly lastSeenAt: string;
  readonly state: "active" | "idle" | "ended";
}

export interface CustomerPresenceRow {
  readonly customerId: CustomerId;
  readonly status: "active" | "last_seen";
  readonly lastSeenAt: string;
  readonly label: string;
}

export function projectCustomerPresence(args: {
  readonly sessions: readonly PresenceSessionInput[];
  readonly now: string;
  readonly ttlMs?: number;
}): readonly CustomerPresenceRow[] {
  const ttl = args.ttlMs ?? DEFAULT_PRESENCE_TTL_MS;
  const nowMs = Date.parse(args.now);
  const byCustomer = new Map<string, PresenceSessionInput>();
  for (const session of args.sessions) {
    if (!session.customerId || session.state === "ended") continue;
    const existing = byCustomer.get(session.customerId);
    if (
      !existing ||
      Date.parse(session.lastSeenAt) > Date.parse(existing.lastSeenAt)
    ) {
      byCustomer.set(session.customerId, session);
    }
  }

  const rows: CustomerPresenceRow[] = [];
  for (const session of byCustomer.values()) {
    if (!session.customerId) continue;
    const age = nowMs - Date.parse(session.lastSeenAt);
    const active = age >= 0 && age <= ttl && session.state !== "ended";
    rows.push({
      customerId: session.customerId,
      status: active ? "active" : "last_seen",
      lastSeenAt: session.lastSeenAt,
      label: active ? "Active now" : `Last seen ${session.lastSeenAt}`,
    });
  }
  return rows.sort((a, b) =>
    a.status === b.status
      ? b.lastSeenAt.localeCompare(a.lastSeenAt)
      : a.status === "active"
        ? -1
        : 1,
  );
}

export interface OpportunityFunnelCounts {
  readonly draft: number;
  readonly accepted: number;
  readonly snoozed: number;
  readonly dismissed: number;
  readonly incorrect: number;
  readonly completed: number;
  readonly expired: number;
  readonly contactPressureDrafts: number;
}

export function projectOpportunityFunnel(
  opportunities: readonly {
    readonly status: ClientelingOpportunityStatus;
    readonly contactPressure: boolean;
  }[],
): OpportunityFunnelCounts {
  let draft = 0;
  let accepted = 0;
  let snoozed = 0;
  let dismissed = 0;
  let incorrect = 0;
  let completed = 0;
  let expired = 0;
  let contactPressureDrafts = 0;
  for (const opportunity of opportunities) {
    switch (opportunity.status) {
      case "draft":
        draft += 1;
        if (opportunity.contactPressure) contactPressureDrafts += 1;
        break;
      case "accepted":
        accepted += 1;
        break;
      case "snoozed":
        snoozed += 1;
        break;
      case "dismissed":
        dismissed += 1;
        break;
      case "incorrect":
        incorrect += 1;
        break;
      case "completed":
        completed += 1;
        break;
      case "expired":
        expired += 1;
        break;
    }
  }
  return {
    draft,
    accepted,
    snoozed,
    dismissed,
    incorrect,
    completed,
    expired,
    contactPressureDrafts,
  };
}

export interface HourlyHeatCell {
  readonly hour: number;
  readonly count: number;
}

/**
 * Aggregate event counts by local hour-of-day (0–23). Caller supplies
 * already-localized hour integers so timezone honesty stays at the edge.
 */
export function projectHourlyHeatmap(
  localHours: readonly number[],
): readonly HourlyHeatCell[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const hour of localHours) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    const cell = buckets[hour];
    if (cell) cell.count += 1;
  }
  return buckets;
}

export interface ClientelingDashboardProjection {
  readonly retailerId: RetailerId;
  readonly generatedAt: string;
  readonly projectorVersion: string;
  readonly presenceTtlMs: number;
  readonly presence: readonly CustomerPresenceRow[];
  readonly opportunityFunnel: OpportunityFunnelCounts;
  readonly hourlyHeatmap: readonly HourlyHeatCell[];
  readonly assignedStaffId?: StaffId;
}
