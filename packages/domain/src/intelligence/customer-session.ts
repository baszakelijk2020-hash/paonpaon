/**
 * First-party customer interaction sessions (CLI-001 / PHASE 7.2 / ADR-066).
 * Signed-in sessions carry route/visibility context; anonymous persistence
 * remains jurisdiction-gated separately via AnonymousSessionId.
 */

import type {
  CustomerId,
  CustomerInteractionSessionId,
  RetailerId,
} from "../shared/branded-id";
import { asId } from "../shared/branded-id";

export const SESSION_LIFECYCLE_EVENT_NAMES = [
  "session_started",
  "session_resumed",
  "session_heartbeat",
  "session_ended",
] as const;

export type SessionLifecycleEventName =
  (typeof SESSION_LIFECYCLE_EVENT_NAMES)[number];

export const SESSION_CONTEXT_EVENT_NAMES = [
  "page_visibility_changed",
  "route_impression",
  "product_card_impression",
  "product_dwell_threshold",
  "scroll_depth_threshold",
  "tie_mate_impression",
] as const;

export type SessionContextEventName =
  (typeof SESSION_CONTEXT_EVENT_NAMES)[number];

export const SESSION_VISIBILITY_STATES = ["visible", "hidden", "idle"] as const;

export type SessionVisibilityState = (typeof SESSION_VISIBILITY_STATES)[number];

/** Default idle gap before a resumed visit becomes a new session. */
export const DEFAULT_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Client heartbeat cadence while the page is visible. */
export const DEFAULT_SESSION_HEARTBEAT_INTERVAL_MS = 60 * 1000;

/** Minimum dwell before a product_card_impression promotes to dwell threshold. */
export const DEFAULT_PRODUCT_DWELL_THRESHOLD_MS = 3_000;

export interface CustomerInteractionSession {
  readonly id: CustomerInteractionSessionId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly startedAt: string;
  readonly lastHeartbeatAt: string;
  readonly endedAt?: string;
  readonly route: string;
  readonly visibilityState: SessionVisibilityState;
  readonly idleSince?: string;
}

export interface StartCustomerSessionInput {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly route: string;
  readonly now: string;
  readonly resumeSessionId?: CustomerInteractionSessionId;
  readonly lastHeartbeatAt?: string;
  readonly idleTimeoutMs?: number;
}

export interface HeartbeatCustomerSessionInput {
  readonly sessionId: CustomerInteractionSessionId;
  readonly now: string;
  readonly visibilityState: SessionVisibilityState;
  readonly route?: string;
}

export interface EndCustomerSessionInput {
  readonly sessionId: CustomerInteractionSessionId;
  readonly now: string;
}

export function isSessionLifecycleEventName(
  value: string,
): value is SessionLifecycleEventName {
  return (SESSION_LIFECYCLE_EVENT_NAMES as readonly string[]).includes(value);
}

export function isSessionContextEventName(
  value: string,
): value is SessionContextEventName {
  return (SESSION_CONTEXT_EVENT_NAMES as readonly string[]).includes(value);
}

export function isSessionVisibilityState(
  value: string,
): value is SessionVisibilityState {
  return (SESSION_VISIBILITY_STATES as readonly string[]).includes(value);
}

function asUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return null;
  }
  return value;
}

export function sessionIdFromEventProperties(
  properties: Readonly<Record<string, unknown>>,
): CustomerInteractionSessionId | null {
  const sessionId = asUuid(properties.sessionId);
  return sessionId ? asId<"CustomerInteractionSessionId">(sessionId) : null;
}

export function idempotencyKeyFromEventProperties(
  properties: Readonly<Record<string, unknown>>,
): string | null {
  const key = properties.idempotencyKey;
  if (typeof key !== "string") return null;
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resume an open session when the last heartbeat is within the idle window.
 * Returns null when a fresh session should be created server-side.
 */
export function resolveSessionResume(args: {
  readonly resumeSessionId?: CustomerInteractionSessionId;
  readonly lastHeartbeatAt?: string;
  readonly now: string;
  readonly idleTimeoutMs?: number;
}): CustomerInteractionSessionId | null {
  const idleTimeoutMs = args.idleTimeoutMs ?? DEFAULT_SESSION_IDLE_TIMEOUT_MS;
  if (!args.resumeSessionId || !args.lastHeartbeatAt) return null;
  const elapsed = Date.parse(args.now) - Date.parse(args.lastHeartbeatAt);
  if (elapsed >= 0 && elapsed <= idleTimeoutMs) {
    return args.resumeSessionId;
  }
  return null;
}

export function shouldEmitHeartbeat(args: {
  readonly lastHeartbeatAt: string;
  readonly now: string;
  readonly intervalMs?: number;
}): boolean {
  const intervalMs = args.intervalMs ?? DEFAULT_SESSION_HEARTBEAT_INTERVAL_MS;
  return Date.parse(args.now) - Date.parse(args.lastHeartbeatAt) >= intervalMs;
}

export function buildSessionContextProperties(args: {
  readonly sessionId: CustomerInteractionSessionId;
  readonly route: string;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
  readonly sequence?: number;
  readonly context?: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> {
  return {
    sessionId: args.sessionId,
    route: args.route,
    idempotencyKey: args.idempotencyKey,
    ...(args.correlationId ? { correlationId: args.correlationId } : {}),
    ...(args.sequence !== undefined ? { sequence: args.sequence } : {}),
    ...(args.context ?? {}),
  };
}
