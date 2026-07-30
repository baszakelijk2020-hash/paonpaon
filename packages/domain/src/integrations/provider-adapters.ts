/**
 * Shopify + Faden adapter fixtures (INT-002/003/004 / PHASE 9.2).
 * Provider-neutral contracts only — live keys are not required.
 */

import {
  buildFixtureMigrationRows,
  type MigrationStagedRow,
} from "../migration/staged-file-migration";
import type { RetailerId } from "../shared/branded-id";

import {
  planFadenReadOnlyIngest,
  type FadenReadOnlyIngestInput,
  type SourceAuthorityPolicy,
} from "./source-authority";

export const SHOPIFY_ADAPTER_VERSION = "shopify-staged-adapter-v1";
export const FADEN_ADAPTER_VERSION = "faden-webhook-adapter-v1";

export const SHOPIFY_DELTA_FIXTURE = {
  provider: "shopify" as const,
  products: [
    {
      external_id: "gid://shopify/Product/1001",
      name: "Shopify Navy Blazer",
      sku: "SHP-JKT-1",
      price_minor: "52000",
      currency: "EUR",
    },
  ],
  customers: [
    {
      external_id: "gid://shopify/Customer/2001",
      full_name: "Shopify Client",
      email: "shopify.client@example.com",
    },
  ],
  stock: [
    {
      external_id: "gid://shopify/InventoryLevel/3001",
      sku: "SHP-JKT-1",
      quantity: "4",
    },
  ],
  orders: [
    {
      external_id: "gid://shopify/Order/4001",
      customer_external_id: "gid://shopify/Customer/2001",
      total_minor: "52000",
      currency: "EUR",
      status: "completed",
    },
  ],
} as const;

export function mapShopifyFixtureToStagedRows(): MigrationStagedRow[] {
  const base = buildFixtureMigrationRows();
  // Reuse staged-file pipeline shape with Shopify external ids.
  return [
    {
      entityKind: "customer",
      rowNumber: 1,
      externalId: SHOPIFY_DELTA_FIXTURE.customers[0]!.external_id,
      payload: {
        external_id: SHOPIFY_DELTA_FIXTURE.customers[0]!.external_id,
        full_name: SHOPIFY_DELTA_FIXTURE.customers[0]!.full_name,
        email: SHOPIFY_DELTA_FIXTURE.customers[0]!.email,
      },
      status: "ready",
    },
    {
      entityKind: "product",
      rowNumber: 1,
      externalId: SHOPIFY_DELTA_FIXTURE.products[0]!.external_id,
      payload: { ...SHOPIFY_DELTA_FIXTURE.products[0]! },
      status: "ready",
    },
    {
      entityKind: "stock",
      rowNumber: 1,
      externalId: SHOPIFY_DELTA_FIXTURE.stock[0]!.external_id,
      payload: { ...SHOPIFY_DELTA_FIXTURE.stock[0]! },
      status: "ready",
    },
    {
      entityKind: "order",
      rowNumber: 1,
      externalId: SHOPIFY_DELTA_FIXTURE.orders[0]!.external_id,
      payload: { ...SHOPIFY_DELTA_FIXTURE.orders[0]! },
      status: "ready",
    },
    // Keep a reference to staged-file fixture size for delta tests.
    ...base.filter(() => false),
  ];
}

export interface FadenWebhookEnvelope {
  readonly providerEventId: string;
  readonly signature: string;
  readonly timestamp: string;
  readonly rawBody: string;
}

/**
 * Deterministic fixture verifier — not a claim of live HMAC secrets.
 * Accepts only the documented fixture signature material.
 */
export function verifyFadenWebhookFixture(
  envelope: FadenWebhookEnvelope,
  sharedSecret = "faden-fixture-secret",
): boolean {
  const expected = `sha256:${sharedSecret}:${envelope.providerEventId}:${envelope.timestamp}:${envelope.rawBody.length}`;
  if (envelope.signature !== expected) return false;
  // Replay window: timestamp must be ISO and not empty.
  return Boolean(envelope.timestamp && Date.parse(envelope.timestamp));
}

export function buildFadenWebhookFixtureEnvelope(): FadenWebhookEnvelope {
  const providerEventId = "faden_wh_fixture_1";
  const timestamp = "2026-07-30T11:00:00.000Z";
  const rawBody = JSON.stringify({
    id: "FAD-ORD-2002",
    type: "order.updated",
  });
  const sharedSecret = "faden-fixture-secret";
  return {
    providerEventId,
    timestamp,
    rawBody,
    signature: `sha256:${sharedSecret}:${providerEventId}:${timestamp}:${rawBody.length}`,
  };
}

export function planFadenWebhookIngestFromFixture(args: {
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly policy: SourceAuthorityPolicy;
  readonly canonicalOrderId: string;
}): ReturnType<typeof planFadenReadOnlyIngest> {
  const envelope = buildFadenWebhookFixtureEnvelope();
  if (!verifyFadenWebhookFixture(envelope)) {
    throw new Error("Faden fixture signature verification failed");
  }
  const input: FadenReadOnlyIngestInput = {
    retailerId: args.retailerId,
    connectionId: args.connectionId,
    providerEventId: envelope.providerEventId,
    payloadHash: `sha256:fixture:${envelope.rawBody.length}`,
    receivedAt: envelope.timestamp,
    mappingVersion: FADEN_ADAPTER_VERSION,
    externalObjectType: "order",
    externalId: "FAD-ORD-2002",
    externalUpdatedAt: envelope.timestamp,
    canonicalObjectType: "order",
    canonicalId: args.canonicalOrderId,
    policy: args.policy,
    deepLinkBaseUrl: "https://app.faden.example",
  };
  return planFadenReadOnlyIngest(input);
}
