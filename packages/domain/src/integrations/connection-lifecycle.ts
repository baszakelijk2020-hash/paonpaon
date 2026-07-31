/**
 * Integration connection lifecycle (INT-002 / INT-003 / INT-004 / PHASE 9.2).
 *
 * Completes source-authority.ts's IntegrationConnection with the operator
 * lifecycle 9.2's acceptance criteria requires to be observable: pause/
 * resume/disconnect distinct from observed health, sync cursors, run
 * history, dead letters and reconciliation aggregates. Pure domain logic
 * only — no I/O, no Supabase types.
 */

import type { RetailerId } from "../shared/branded-id";

export const CONNECTION_OPERATIONAL_STATES = [
  "active",
  "paused",
  "disconnected",
] as const;

export type ConnectionOperationalState =
  (typeof CONNECTION_OPERATIONAL_STATES)[number];

export const INTEGRATION_SECRET_KINDS = [
  "api_key",
  "webhook_shared_secret",
  "oauth_access_token",
  "oauth_refresh_token",
] as const;

export type IntegrationSecretKind = (typeof INTEGRATION_SECRET_KINDS)[number];

export const SYNC_RUN_TRIGGER_KINDS = [
  "scheduled",
  "webhook",
  "manual",
] as const;

export type SyncRunTriggerKind = (typeof SYNC_RUN_TRIGGER_KINDS)[number];

export const SYNC_RUN_STATUSES = [
  "running",
  "succeeded",
  "failed",
  "partial",
] as const;

export type SyncRunStatus = (typeof SYNC_RUN_STATUSES)[number];

export const DEAD_LETTER_FAILURE_REASONS = [
  "signature_invalid",
  "replay_rejected",
  "mapping_error",
  "validation_error",
  "downstream_error",
  "other",
] as const;

export type DeadLetterFailureReason =
  (typeof DEAD_LETTER_FAILURE_REASONS)[number];

export const DEAD_LETTER_RESOLUTIONS = [
  "retried_success",
  "discarded",
  "manual_fix",
] as const;

export type DeadLetterResolution = (typeof DEAD_LETTER_RESOLUTIONS)[number];

export interface ConnectionSecretRef {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly kind: IntegrationSecretKind;
  /** Pointer only (env var name / vault path / KMS key id) — never a value. */
  readonly secretRef?: string;
  readonly lastRotatedAt?: string;
  readonly revokedAt?: string;
}

export interface SyncCursor {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly resource: string;
  readonly cursorValue: Record<string, unknown>;
  readonly lastSyncedAt?: string;
}

export interface SyncRun {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly triggerKind: SyncRunTriggerKind;
  readonly status: SyncRunStatus;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly recordsProcessed: number;
  readonly recordsFailed: number;
  readonly errorSummary?: string;
}

export interface DeadLetter {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly runId?: string;
  readonly providerEventId?: string;
  readonly failureReason: DeadLetterFailureReason;
  readonly failureDetail: Record<string, unknown>;
  readonly retryCount: number;
  readonly firstFailedAt: string;
  readonly lastAttemptedAt: string;
  readonly resolvedAt?: string;
  readonly resolution?: DeadLetterResolution;
}

export interface ReconciliationReport {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly runId?: string;
  readonly resource: string;
  readonly matchedCount: number;
  readonly conflictCount: number;
  readonly staleCount: number;
  readonly deadLetterCount: number;
  readonly generatedAt: string;
}

/** Every operational-state transition this system allows an operator to make. */
const ALLOWED_OPERATIONAL_TRANSITIONS: Readonly<
  Record<ConnectionOperationalState, readonly ConnectionOperationalState[]>
> = {
  active: ["paused", "disconnected"],
  paused: ["active", "disconnected"],
  // Reconnecting after a deliberate disconnect is a new connection record,
  // not a resurrection of the old one — its cursors and secrets should not
  // silently reactivate. This is the same reasoning
  // buildFadenDeepLinkHandoff's "never invent write-back" comment applies to
  // sync direction: a state boundary is a contract, not a convenience.
  disconnected: [],
};

export type OperationalTransitionRejectionReason =
  "already_in_state" | "transition_not_allowed";

export type OperationalTransitionResult =
  | { readonly ok: true; readonly nextState: ConnectionOperationalState }
  | {
      readonly ok: false;
      readonly reason: OperationalTransitionRejectionReason;
    };

/**
 * Validates (without performing) an operator-requested lifecycle transition.
 * The repository/service layer is responsible for actually persisting the
 * result; this function only decides whether the transition is legal.
 */
export function planConnectionOperationalTransition(args: {
  readonly currentState: ConnectionOperationalState;
  readonly requestedState: ConnectionOperationalState;
}): OperationalTransitionResult {
  const { currentState, requestedState } = args;
  if (currentState === requestedState) {
    return { ok: false, reason: "already_in_state" };
  }
  const allowed = ALLOWED_OPERATIONAL_TRANSITIONS[currentState];
  if (!allowed.includes(requestedState)) {
    return { ok: false, reason: "transition_not_allowed" };
  }
  return { ok: true, nextState: requestedState };
}

/**
 * A connector must not be scheduled or receive webhooks while paused or
 * disconnected. This is the single predicate every ingest entry point
 * (scheduler tick, webhook route) must check before doing any work — kept
 * here so the rule can never drift between the two call sites.
 */
export function connectionAcceptsIngest(
  operationalState: ConnectionOperationalState,
): boolean {
  return operationalState === "active";
}

/**
 * Decides the next reconciliation-facing severity for a connection given its
 * accumulated dead-letter and conflict counts. Pure classification only —
 * callers decide what UI treatment or alert follows.
 */
export type ReconciliationSeverity = "clean" | "attention" | "critical";

export function classifyReconciliationSeverity(report: {
  readonly conflictCount: number;
  readonly deadLetterCount: number;
  readonly matchedCount: number;
}): ReconciliationSeverity {
  const { conflictCount, deadLetterCount, matchedCount } = report;
  const totalConsidered = matchedCount + conflictCount + deadLetterCount;
  if (totalConsidered === 0) return "clean";
  const problemRatio = (conflictCount + deadLetterCount) / totalConsidered;
  if (deadLetterCount > 0 && problemRatio >= 0.1) return "critical";
  if (conflictCount > 0 || deadLetterCount > 0) return "attention";
  return "clean";
}
