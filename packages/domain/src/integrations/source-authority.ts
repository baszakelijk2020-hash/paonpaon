/**
 * Source-authority and external-identity registry (INT-001 / INT-003 /
 * INT-004 / PHASE 8.2 / ADR-067).
 *
 * Authority is configured by domain/field group. "Two-way sync" is not a
 * valid contract. Faden read-only ingest may deep-link; it must never invent
 * write-back.
 */

import type { RetailerId } from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const INTEGRATION_PROVIDERS = [
  "faden",
  "shopify",
  "staged_file",
  "other",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const SOURCE_AUTHORITY_DOMAINS = [
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

export type SourceAuthorityDomain = (typeof SOURCE_AUTHORITY_DOMAINS)[number];

export const SOURCE_AUTHORITY_MODES = [
  "paon",
  "external",
  "co_managed",
] as const;

export type SourceAuthorityMode = (typeof SOURCE_AUTHORITY_MODES)[number];

export const SOURCE_AUTHORITY_DIRECTIONS = [
  "ingest",
  "export",
  "write_api",
] as const;

export type SourceAuthorityDirection =
  (typeof SOURCE_AUTHORITY_DIRECTIONS)[number];

export const CONNECTION_HEALTH_STATUSES = [
  "healthy",
  "degraded",
  "stale",
  "failed",
  "disconnected",
] as const;

export type ConnectionHealthStatus =
  (typeof CONNECTION_HEALTH_STATUSES)[number];

export const RECONCILIATION_STATUSES = [
  "matched",
  "pending",
  "conflict",
  "stale",
  "dead_letter",
] as const;

export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export const INTEGRATION_CONNECTION_PROJECTOR_VERSION = "source-authority-v1";

export interface IntegrationConnection extends Timestamps {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly provider: IntegrationProvider;
  readonly displayName: string;
  readonly healthStatus: ConnectionHealthStatus;
  readonly lastSuccessAt?: string;
  readonly lastErrorAt?: string;
  readonly lastErrorSummary?: string;
  readonly lagSeconds: number;
  readonly deepLinkBaseUrl?: string;
}

export interface SourceAuthorityPolicy extends Timestamps {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly domain: SourceAuthorityDomain;
  /** Material field group within the domain (e.g. order.status). */
  readonly fieldGroup: string;
  readonly authority: SourceAuthorityMode;
  readonly allowedDirections: readonly SourceAuthorityDirection[];
  readonly mappingVersion: string;
}

export interface ExternalIdentity extends Timestamps {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly domain: SourceAuthorityDomain;
  readonly externalObjectType: string;
  readonly externalId: string;
  readonly canonicalObjectType: string;
  readonly canonicalId: string;
  readonly externalVersion?: string;
  readonly externalUpdatedAt?: string;
  readonly rawEventId?: string;
  readonly mappingVersion: string;
  readonly reconciliationStatus: ReconciliationStatus;
  readonly conflictSummary?: string;
}

export interface IntegrationRawEvent {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly providerEventId: string;
  readonly payloadHash: string;
  readonly receivedAt: string;
  readonly mappingVersion: string;
  readonly direction: SourceAuthorityDirection;
}

export interface SourceAuthorityConflict {
  readonly code:
    | "write_api_not_allowed"
    | "authority_conflict"
    | "stale_source"
    | "duplicate_external_id"
    | "missing_raw_reference"
    | "invalid_direction";
  readonly message: string;
}

export function mayPerformDirection(args: {
  readonly policy: Pick<
    SourceAuthorityPolicy,
    "authority" | "allowedDirections"
  >;
  readonly direction: SourceAuthorityDirection;
}): boolean {
  if (!args.policy.allowedDirections.includes(args.direction)) {
    return false;
  }
  if (args.direction === "write_api" && args.policy.authority === "paon") {
    // PAON-owned fields are written in PAON, not via external write API.
    return false;
  }
  return true;
}

/**
 * Fail visibly when an ingest would overwrite a PAON-owned field or when
 * write-back is requested without an allowed write_api direction.
 */
export function evaluateSourceAuthorityAction(args: {
  readonly policy: SourceAuthorityPolicy;
  readonly direction: SourceAuthorityDirection;
  readonly externalUpdatedAt?: string;
  readonly knownExternalUpdatedAt?: string;
}):
  | { readonly ok: true }
  | { readonly ok: false; readonly conflict: SourceAuthorityConflict } {
  if (!mayPerformDirection(args)) {
    if (args.direction === "write_api") {
      return {
        ok: false,
        conflict: {
          code: "write_api_not_allowed",
          message:
            "Write-back is not allowed for this domain/field group. Use deep-link handoff instead.",
        },
      };
    }
    return {
      ok: false,
      conflict: {
        code: "invalid_direction",
        message: `Direction ${args.direction} is not configured for ${args.policy.domain}/${args.policy.fieldGroup}.`,
      },
    };
  }

  if (
    args.direction === "ingest" &&
    args.policy.authority === "paon" &&
    args.policy.fieldGroup !== "mirror_only"
  ) {
    return {
      ok: false,
      conflict: {
        code: "authority_conflict",
        message:
          "PAON is the authority for this field group; external ingest cannot overwrite it.",
      },
    };
  }

  if (
    args.externalUpdatedAt &&
    args.knownExternalUpdatedAt &&
    Date.parse(args.externalUpdatedAt) < Date.parse(args.knownExternalUpdatedAt)
  ) {
    return {
      ok: false,
      conflict: {
        code: "stale_source",
        message: "Incoming external version is older than the mapped identity.",
      },
    };
  }

  return { ok: true };
}

export function buildExternalIdentityKey(args: {
  readonly connectionId: string;
  readonly domain: SourceAuthorityDomain;
  readonly externalObjectType: string;
  readonly externalId: string;
}): string {
  return [
    args.connectionId,
    args.domain,
    args.externalObjectType,
    args.externalId,
  ].join(":");
}

export interface FadenDeepLinkHandoff {
  readonly kind: "faden_deep_link";
  readonly connectionId: string;
  readonly externalObjectType: "client" | "order";
  readonly externalId: string;
  readonly url: string;
  readonly writeBackClaimed: false;
  readonly instruction: string;
}

/**
 * Provider-neutral deep-link handoff. Never claims a writable Faden API.
 */
export function buildFadenDeepLinkHandoff(args: {
  readonly connectionId: string;
  readonly deepLinkBaseUrl: string;
  readonly externalObjectType: "client" | "order";
  readonly externalId: string;
}): FadenDeepLinkHandoff {
  const base = args.deepLinkBaseUrl.replace(/\/$/, "");
  const path =
    args.externalObjectType === "client"
      ? `/clients/${encodeURIComponent(args.externalId)}`
      : `/orders/${encodeURIComponent(args.externalId)}`;
  return {
    kind: "faden_deep_link",
    connectionId: args.connectionId,
    externalObjectType: args.externalObjectType,
    externalId: args.externalId,
    url: `${base}${path}`,
    writeBackClaimed: false,
    instruction:
      "Open the Faden record to complete the action. Confirm completion only after webhook/API reconciliation.",
  };
}

export interface FadenReadOnlyIngestInput {
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly providerEventId: string;
  readonly payloadHash: string;
  readonly receivedAt: string;
  readonly mappingVersion: string;
  readonly externalObjectType: "client" | "order";
  readonly externalId: string;
  readonly externalUpdatedAt: string;
  readonly canonicalObjectType: "customer" | "order";
  readonly canonicalId: string;
  readonly policy: SourceAuthorityPolicy;
  readonly knownExternalUpdatedAt?: string;
  readonly deepLinkBaseUrl?: string;
}

export interface FadenReadOnlyIngestResult {
  readonly ok: boolean;
  readonly conflict?: SourceAuthorityConflict;
  readonly identityKey?: string;
  readonly reconciliationStatus?: ReconciliationStatus;
  readonly deepLink?: FadenDeepLinkHandoff;
  readonly writeBackClaimed: false;
}

/**
 * Pure Faden read-only ingest decision. Persistence is the repository's job.
 * Always returns writeBackClaimed: false.
 */
export function planFadenReadOnlyIngest(
  input: FadenReadOnlyIngestInput,
): FadenReadOnlyIngestResult {
  const evaluation = evaluateSourceAuthorityAction({
    policy: input.policy,
    direction: "ingest",
    ...(input.externalUpdatedAt
      ? { externalUpdatedAt: input.externalUpdatedAt }
      : {}),
    ...(input.knownExternalUpdatedAt
      ? { knownExternalUpdatedAt: input.knownExternalUpdatedAt }
      : {}),
  });

  if (!evaluation.ok) {
    return {
      ok: false,
      conflict: evaluation.conflict,
      reconciliationStatus: "conflict",
      writeBackClaimed: false,
      ...(input.deepLinkBaseUrl
        ? {
            deepLink: buildFadenDeepLinkHandoff({
              connectionId: input.connectionId,
              deepLinkBaseUrl: input.deepLinkBaseUrl,
              externalObjectType: input.externalObjectType,
              externalId: input.externalId,
            }),
          }
        : {}),
    };
  }

  return {
    ok: true,
    identityKey: buildExternalIdentityKey({
      connectionId: input.connectionId,
      domain: input.policy.domain,
      externalObjectType: input.externalObjectType,
      externalId: input.externalId,
    }),
    reconciliationStatus: "matched",
    writeBackClaimed: false,
    ...(input.deepLinkBaseUrl
      ? {
          deepLink: buildFadenDeepLinkHandoff({
            connectionId: input.connectionId,
            deepLinkBaseUrl: input.deepLinkBaseUrl,
            externalObjectType: input.externalObjectType,
            externalId: input.externalId,
          }),
        }
      : {}),
  };
}
