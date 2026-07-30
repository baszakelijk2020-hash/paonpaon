/**
 * Neutral Faden read-only fixture (PHASE 8.2). Exercises ingest + deep-link handoff
 * without live credentials or fake write-back.
 */

import type { RetailerId, SourceConnectionId } from "../shared/branded-id";

import type {
  ExternalIdentityReconcileInput,
  SourceDomain,
  SyncDirection,
} from "./source-authority";
import { reconcileExternalIdentity } from "./source-authority";

export const FADEN_FIXTURE_MAPPING_VERSION = "faden-readonly-v1";
export const FADEN_FIXTURE_PROVIDER_EVENT_ID = "faden-fixture-order-10042";
export const FADEN_FIXTURE_EXTERNAL_ORDER_ID = "FAD-ORD-10042";
export const FADEN_FIXTURE_CANONICAL_ORDER_ID =
  "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

export const DEFAULT_FADEN_PRODUCTION_POLICY = {
  domain: "production" as SourceDomain,
  fieldGroup: "order_status",
  authorityMode: "co_managed" as const,
  allowedDirections: ["ingest"] as const satisfies readonly SyncDirection[],
};

export interface FadenFixtureOrderPayload {
  readonly id: string;
  readonly version: string;
  readonly updated_at: string;
  readonly status: string;
  readonly client_ref: string;
  readonly garment: string;
}

export const FADEN_FIXTURE_ORDER: FadenFixtureOrderPayload = {
  id: FADEN_FIXTURE_EXTERNAL_ORDER_ID,
  version: "3",
  updated_at: "2026-07-30T08:00:00.000Z",
  status: "in_production",
  client_ref: "client-smith-001",
  garment: "bespoke-navy-suit",
};

export interface FadenFixtureIngestPlan {
  readonly providerEventId: string;
  readonly payloadHash: string;
  readonly rawPayload: Readonly<Record<string, unknown>>;
  readonly externalIdentity: {
    readonly domain: SourceDomain;
    readonly externalObjectType: "production_order";
    readonly externalId: string;
    readonly canonicalType: "production_order";
    readonly canonicalId: string;
    readonly externalVersion: string;
    readonly mappingVersion: string;
  };
  readonly reconciliation: ReturnType<typeof reconcileExternalIdentity>;
  readonly deepLinkUrl: string;
  readonly writeBackPermitted: false;
}

export function buildFadenOrderDeepLink(externalOrderId: string): string {
  const encoded = encodeURIComponent(externalOrderId);
  return `https://app.faden.tech/orders/${encoded}`;
}

export function hashFadenFixturePayload(
  payload: Readonly<Record<string, unknown>>,
): string {
  const serialized = JSON.stringify(payload);
  let hash = 0;
  for (let index = 0; index < serialized.length; index += 1) {
    hash = (hash * 31 + serialized.charCodeAt(index)) >>> 0;
  }
  return `faden-fixture-${hash.toString(16).padStart(8, "0")}`;
}

export function buildFadenFixtureIngestPlan(args: {
  readonly retailerId: RetailerId;
  readonly connectionId: SourceConnectionId;
  readonly order?: FadenFixtureOrderPayload;
  readonly existingIdentity?: ExternalIdentityReconcileInput["existing"];
  readonly canonicalOrderId?: string;
}): FadenFixtureIngestPlan {
  const order = args.order ?? FADEN_FIXTURE_ORDER;
  const rawPayload = {
    provider: "faden",
    fixture: true,
    retailerId: args.retailerId,
    connectionId: args.connectionId,
    order,
  };

  const externalIdentity = {
    domain: "production" as SourceDomain,
    externalObjectType: "production_order" as const,
    externalId: order.id,
    canonicalType: "production_order" as const,
    canonicalId: args.canonicalOrderId ?? FADEN_FIXTURE_CANONICAL_ORDER_ID,
    externalVersion: order.version,
    mappingVersion: FADEN_FIXTURE_MAPPING_VERSION,
  };

  const reconciliation = reconcileExternalIdentity({
    ...(args.existingIdentity ? { existing: args.existingIdentity } : {}),
    incoming: externalIdentity,
  });

  return {
    providerEventId: FADEN_FIXTURE_PROVIDER_EVENT_ID,
    payloadHash: hashFadenFixturePayload(rawPayload),
    rawPayload,
    externalIdentity,
    reconciliation,
    deepLinkUrl: buildFadenOrderDeepLink(order.id),
    writeBackPermitted: false,
  };
}
