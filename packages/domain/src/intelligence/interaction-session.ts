/**
 * First-party interaction session contracts (CLI-001 / PHASE 7.2 / ADR-066).
 * Authenticated PAON/storefront sessions only for local build; anonymous
 * persistence remains jurisdiction-gated.
 */

import type {
  AnonymousSessionId,
  CustomerId,
  InteractionSessionId,
  RetailerId,
} from "../shared/branded-id";

export const INTERACTION_SESSION_STATES = ["active", "idle", "ended"] as const;

export type InteractionSessionState =
  (typeof INTERACTION_SESSION_STATES)[number];

export const INTERACTION_DEVICE_CLASSES = [
  "mobile",
  "tablet",
  "desktop",
  "unknown",
] as const;

export type InteractionDeviceClass =
  (typeof INTERACTION_DEVICE_CLASSES)[number];

/** Default idle window before a session is treated as ended (minutes). */
export const DEFAULT_SESSION_IDLE_MINUTES = 30;

export interface InteractionSession {
  readonly id: InteractionSessionId;
  readonly retailerId: RetailerId;
  readonly customerId?: CustomerId;
  readonly anonymousSessionId?: AnonymousSessionId;
  readonly state: InteractionSessionState;
  readonly startedAt: string;
  readonly lastSeenAt: string;
  readonly endedAt?: string;
  readonly deviceClass: InteractionDeviceClass;
  readonly locale?: string;
  readonly timezone?: string;
  readonly userAgentClass?: string;
}

export interface EnsureInteractionSessionInput {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly now: string;
  readonly deviceClass?: InteractionDeviceClass;
  readonly locale?: string;
  readonly timezone?: string;
  readonly idleMinutes?: number;
  readonly existing?: InteractionSession | null;
}

export function isInteractionDeviceClass(
  value: string,
): value is InteractionDeviceClass {
  return (INTERACTION_DEVICE_CLASSES as readonly string[]).includes(value);
}

export function sessionIsOpen(args: {
  readonly session: InteractionSession;
  readonly now: string;
  readonly idleMinutes?: number;
}): boolean {
  if (args.session.state === "ended" || args.session.endedAt) return false;
  const idleMs = (args.idleMinutes ?? DEFAULT_SESSION_IDLE_MINUTES) * 60 * 1000;
  const lastSeen = Date.parse(args.session.lastSeenAt);
  const now = Date.parse(args.now);
  if (Number.isNaN(lastSeen) || Number.isNaN(now)) return false;
  return now - lastSeen < idleMs;
}

/**
 * Pure decision: resume an open session or start a new one. Persistence
 * happens in `@paon/database`.
 */
export function resolveSessionContinuity(args: EnsureInteractionSessionInput): {
  readonly action: "resume" | "start";
  readonly sessionId?: InteractionSessionId;
  readonly deviceClass: InteractionDeviceClass;
} {
  const deviceClass = args.deviceClass ?? "unknown";
  if (
    args.existing &&
    sessionIsOpen({
      session: args.existing,
      now: args.now,
      ...(args.idleMinutes !== undefined
        ? { idleMinutes: args.idleMinutes }
        : {}),
    })
  ) {
    return {
      action: "resume",
      sessionId: args.existing.id,
      deviceClass,
    };
  }
  return { action: "start", deviceClass };
}
