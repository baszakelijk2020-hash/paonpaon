/**
 * Source authority and external identity registry (INT-001 / PHASE 8.2 / ADR-067).
 * Every co-system field group has explicit authority, external identity, direction,
 * and reconciliation state. Conflicts fail visibly — never silent overwrite.
 */

import type {
  ExternalIdentityId,
  RetailerId,
  SourceAuthorityPolicyId,
  SourceConnectionId,
  SourceReconciliationId,
  SourceSnapshotId,
} from "../shared/branded-id";

export const SOURCE_DOMAINS = [
  "catalogue",
  "inventory",
  "customer",
  "order",
  "payment",
  "production",
  "appointment",
  "message",
  "payroll",
] as const;

export type SourceDomain = (typeof SOURCE_DOMAINS)[number];

export const SOURCE_AUTHORITY_MODES = [
  "paon",
  "external",
  "co_managed",
] as const;

export type SourceAuthorityMode = (typeof SOURCE_AUTHORITY_MODES)[number];

export const SYNC_DIRECTIONS = ["ingest", "export", "write_api"] as const;

export type SyncDirection = (typeof SYNC_DIRECTIONS)[number];

export const RECONCILIATION_STATES = [
  "matched",
  "conflict",
  "stale",
  "unmapped",
  "pending",
] as const;

export type ReconciliationState = (typeof RECONCILIATION_STATES)[number];

export const CONNECTOR_PROVIDERS = ["faden", "shopify", "staged_file"] as const;

export type ConnectorProvider = (typeof CONNECTOR_PROVIDERS)[number];

export const CONNECTION_STATUSES = [
  "active",
  "paused",
  "disconnected",
  "fixture",
] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const CONNECTOR_HEALTH_STATUSES = [
  "healthy",
  "degraded",
  "failed",
  "stale",
] as const;

export type ConnectorHealthStatus = (typeof CONNECTOR_HEALTH_STATUSES)[number];

export const SOURCE_AUTHORITY_REGISTRY_VERSION = "source-authority-v1";

export interface SourceConnection {
  readonly id: SourceConnectionId;
  readonly retailerId: RetailerId;
  readonly provider: ConnectorProvider;
  readonly label: string;
  readonly status: ConnectionStatus;
  readonly mappingVersion: string;
  readonly allowedDirections: readonly SyncDirection[];
  readonly lastSyncAt?: string;
  readonly cursor?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SourceAuthorityPolicy {
  readonly id: SourceAuthorityPolicyId;
  readonly retailerId: RetailerId;
  readonly domain: SourceDomain;
  readonly fieldGroup: string;
  readonly authorityMode: SourceAuthorityMode;
  readonly allowedDirections: readonly SyncDirection[];
  readonly connectionId?: SourceConnectionId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ExternalIdentity {
  readonly id: ExternalIdentityId;
  readonly retailerId: RetailerId;
  readonly connectionId: SourceConnectionId;
  readonly domain: SourceDomain;
  readonly externalObjectType: string;
  readonly externalId: string;
  readonly canonicalType: string;
  readonly canonicalId: string;
  readonly externalVersion: string;
  readonly mappingVersion: string;
  readonly lastSeenAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SourceSnapshot {
  readonly id: SourceSnapshotId;
  readonly retailerId: RetailerId;
  readonly connectionId: SourceConnectionId;
  readonly providerEventId: string;
  readonly payloadHash: string;
  readonly rawPayload: Readonly<Record<string, unknown>>;
  readonly ingestedAt: string;
}

export interface SourceReconciliation {
  readonly id: SourceReconciliationId;
  readonly retailerId: RetailerId;
  readonly externalIdentityId: ExternalIdentityId;
  readonly state: ReconciliationState;
  readonly conflictReason?: string;
  readonly resolvedAt?: string;
  readonly observedAt: string;
}

export interface ConnectorHealthEvent {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly connectionId: SourceConnectionId;
  readonly status: ConnectorHealthStatus;
  readonly lagSeconds: number;
  readonly openConflictCount: number;
  readonly notes?: string;
  readonly observedAt: string;
}

export interface WritePermissionResult {
  readonly permitted: boolean;
  readonly reason?: string;
}

export interface ExternalIdentityReconcileInput {
  readonly existing?: Pick<
    ExternalIdentity,
    "canonicalId" | "externalVersion" | "mappingVersion"
  >;
  readonly incoming: Pick<
    ExternalIdentity,
    "canonicalId" | "externalVersion" | "mappingVersion"
  >;
}

export interface ExternalIdentityReconcileResult {
  readonly state: ReconciliationState;
  readonly conflictReason?: string;
  readonly shouldUpdate: boolean;
}

export function assertWritePermitted(args: {
  readonly authorityMode: SourceAuthorityMode;
  readonly direction: SyncDirection;
  readonly allowedDirections: readonly SyncDirection[];
  readonly fieldGroup: string;
  readonly domain: SourceDomain;
}): WritePermissionResult {
  if (!args.allowedDirections.includes(args.direction)) {
    return {
      permitted: false,
      reason: `${args.domain}/${args.fieldGroup}: direction ${args.direction} is not allowed for this connection`,
    };
  }

  if (args.direction === "write_api" && args.authorityMode === "external") {
    return {
      permitted: false,
      reason: `${args.domain}/${args.fieldGroup}: external authority blocks PAON write_api — use deep-link handoff`,
    };
  }

  if (
    args.direction === "write_api" &&
    args.authorityMode === "co_managed" &&
    !args.allowedDirections.includes("write_api")
  ) {
    return {
      permitted: false,
      reason: `${args.domain}/${args.fieldGroup}: co-managed mode requires explicit write_api approval`,
    };
  }

  return { permitted: true };
}

export function detectStaleSource(args: {
  readonly incomingExternalVersion: string;
  readonly lastSeenExternalVersion?: string;
}): boolean {
  if (!args.lastSeenExternalVersion) {
    return false;
  }
  return (
    compareExternalVersions(
      args.incomingExternalVersion,
      args.lastSeenExternalVersion,
    ) < 0
  );
}

export function reconcileExternalIdentity(
  input: ExternalIdentityReconcileInput,
): ExternalIdentityReconcileResult {
  if (!input.existing) {
    return { state: "pending", shouldUpdate: true };
  }

  if (
    input.existing.mappingVersion !== input.incoming.mappingVersion &&
    input.existing.canonicalId !== input.incoming.canonicalId
  ) {
    return {
      state: "conflict",
      conflictReason: `Mapping version ${input.incoming.mappingVersion} would remap external identity to a different canonical id`,
      shouldUpdate: false,
    };
  }

  if (
    input.existing.canonicalId !== input.incoming.canonicalId &&
    input.existing.externalVersion === input.incoming.externalVersion
  ) {
    return {
      state: "conflict",
      conflictReason: `External id already maps to ${input.existing.canonicalId}, not ${input.incoming.canonicalId}`,
      shouldUpdate: false,
    };
  }

  if (
    detectStaleSource({
      incomingExternalVersion: input.incoming.externalVersion,
      lastSeenExternalVersion: input.existing.externalVersion,
    })
  ) {
    return {
      state: "stale",
      conflictReason: `Incoming external version ${input.incoming.externalVersion} is older than last seen ${input.existing.externalVersion}`,
      shouldUpdate: false,
    };
  }

  if (input.existing.canonicalId === input.incoming.canonicalId) {
    return { state: "matched", shouldUpdate: true };
  }

  return { state: "pending", shouldUpdate: true };
}

export function summarizeConnectionHealth(args: {
  readonly status: ConnectionStatus;
  readonly latestHealth?: ConnectorHealthStatus;
  readonly lagSeconds?: number;
  readonly openConflictCount: number;
  readonly fixtureMode: boolean;
}): ConnectorHealthStatus {
  if (args.fixtureMode) {
    return args.openConflictCount > 0 ? "degraded" : "healthy";
  }
  if (args.status === "disconnected") {
    return "failed";
  }
  if (args.openConflictCount > 0) {
    return "degraded";
  }
  if (args.latestHealth) {
    return args.latestHealth;
  }
  if ((args.lagSeconds ?? 0) > 86_400) {
    return "stale";
  }
  return "healthy";
}

function compareExternalVersions(left: string, right: string): number {
  const leftNum = Number(left);
  const rightNum = Number(right);
  if (!Number.isNaN(leftNum) && !Number.isNaN(rightNum)) {
    return leftNum - rightNum;
  }
  return left.localeCompare(right);
}
