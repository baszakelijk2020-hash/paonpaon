import type { RetailerId, UserId } from "../shared/branded-id";

/**
 * Immutable, append-only. Written by the database layer on every
 * mutating action across all three apps, never by application code
 * directly — see DATABASE.md "Audit Logging".
 */
export interface AuditLogEntry {
  readonly id: string;
  readonly retailerId?: RetailerId;
  readonly actorUserId?: UserId;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly beforeState?: Record<string, unknown>;
  readonly afterState?: Record<string, unknown>;
  readonly occurredAt: string;
}
