/**
 * Faden read-only ingest fixture (INT-004 / PHASE 8.2).
 * Provider-neutral contract only — no live credentials required.
 */

import type { RetailerId } from "../shared/branded-id";

import type {
  FadenReadOnlyIngestInput,
  SourceAuthorityPolicy,
} from "./source-authority";

export const FADEN_FIXTURE_MAPPING_VERSION = "faden-readonly-v1";

export const FADEN_READ_ONLY_ORDER_WEBHOOK_FIXTURE = {
  provider: "faden" as const,
  providerEventId: "faden_evt_fixture_order_1001",
  payloadHash:
    "sha256:8f3c1a9b2e7d4c0a5b6e1f2d3c4b5a697887766554433221100ffeeddccbbaa99",
  receivedAt: "2026-07-30T10:15:00.000Z",
  deepLinkBaseUrl: "https://app.faden.example",
  order: {
    externalObjectType: "order" as const,
    externalId: "FAD-ORD-1001",
    externalUpdatedAt: "2026-07-30T10:14:42.000Z",
    status: "in_production",
    clientExternalId: "FAD-CL-77",
  },
  payload: {
    id: "FAD-ORD-1001",
    type: "order.updated",
    updated_at: "2026-07-30T10:14:42.000Z",
    status: "in_production",
    client_id: "FAD-CL-77",
  },
} as const;

export function buildFadenFixturePolicy(args: {
  readonly retailerId: RetailerId;
  readonly connectionId: string;
}): SourceAuthorityPolicy {
  return {
    id: "fixture-policy-order-status",
    retailerId: args.retailerId,
    connectionId: args.connectionId,
    domain: "order",
    fieldGroup: "order.status",
    authority: "external",
    allowedDirections: ["ingest"],
    mappingVersion: FADEN_FIXTURE_MAPPING_VERSION,
    createdAt: FADEN_READ_ONLY_ORDER_WEBHOOK_FIXTURE.receivedAt,
    updatedAt: FADEN_READ_ONLY_ORDER_WEBHOOK_FIXTURE.receivedAt,
  };
}

export function buildFadenFixtureIngestInput(args: {
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly canonicalOrderId: string;
  readonly knownExternalUpdatedAt?: string;
}): FadenReadOnlyIngestInput {
  const fixture = FADEN_READ_ONLY_ORDER_WEBHOOK_FIXTURE;
  return {
    retailerId: args.retailerId,
    connectionId: args.connectionId,
    providerEventId: fixture.providerEventId,
    payloadHash: fixture.payloadHash,
    receivedAt: fixture.receivedAt,
    mappingVersion: FADEN_FIXTURE_MAPPING_VERSION,
    externalObjectType: fixture.order.externalObjectType,
    externalId: fixture.order.externalId,
    externalUpdatedAt: fixture.order.externalUpdatedAt,
    canonicalObjectType: "order",
    canonicalId: args.canonicalOrderId,
    policy: buildFadenFixturePolicy(args),
    deepLinkBaseUrl: fixture.deepLinkBaseUrl,
    ...(args.knownExternalUpdatedAt
      ? { knownExternalUpdatedAt: args.knownExternalUpdatedAt }
      : {}),
  };
}
