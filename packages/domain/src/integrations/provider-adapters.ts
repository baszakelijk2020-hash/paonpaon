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

export const FADEN_SIGNATURE_SCHEME = "faden-hmac-sha256-v1";

/** Default replay window. A signature older than this is refused. */
export const FADEN_SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Canonical signing payload for a Faden webhook.
 *
 * The provider event id, the timestamp and the **complete raw body** are all
 * bound into the signed material. Binding the body itself rather than its
 * length is what makes tampering detectable: two different payloads of equal
 * length must not produce the same signature.
 *
 * Field order and separator are part of the contract — changing either
 * invalidates every previously issued signature, so this is a versioned format.
 */
export function buildFadenWebhookSigningPayload(
  envelope: Pick<
    FadenWebhookEnvelope,
    "providerEventId" | "timestamp" | "rawBody"
  >,
): string {
  return [
    FADEN_SIGNATURE_SCHEME,
    envelope.providerEventId,
    envelope.timestamp,
    envelope.rawBody,
  ].join("\n");
}

export type FadenSignatureRejectionReason =
  | "signature_malformed"
  | "signature_mismatch"
  | "timestamp_malformed"
  | "timestamp_outside_tolerance";

export type FadenSignatureVerification =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: FadenSignatureRejectionReason };

/**
 * Compares two hex digests without leaking, through timing, how many leading
 * characters matched. Digest length is not a secret, so it is compared first;
 * the per-character loop then always runs over the full digest.
 */
function constantTimeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Verifies a live Faden webhook signature.
 *
 * The HMAC is injected rather than imported so this module stays free of Node
 * builtins — `@paon/domain` is bundled into client components, and pulling
 * `node:crypto` in here would break those builds. A route handler supplies
 * `computeHmacHex`, normally
 * `(secret, payload) => createHmac("sha256", secret).update(payload).digest("hex")`.
 *
 * Rejection carries a typed reason rather than a bare `false` so the ingest
 * lifecycle can record *why* an event was refused: 9.2 requires signature and
 * replay failures to be observable, and "invalid" alone cannot distinguish a
 * forged body from a stale retry.
 */
export function verifyFadenWebhookSignature(args: {
  readonly envelope: FadenWebhookEnvelope;
  readonly sharedSecret: string;
  readonly computeHmacHex: (secret: string, payload: string) => string;
  readonly nowMs: number;
  readonly toleranceSeconds?: number;
}): FadenSignatureVerification {
  const { envelope, sharedSecret, computeHmacHex, nowMs } = args;
  const toleranceSeconds =
    args.toleranceSeconds ?? FADEN_SIGNATURE_TOLERANCE_SECONDS;

  const prefix = `${FADEN_SIGNATURE_SCHEME}=`;
  if (!envelope.signature.startsWith(prefix)) {
    return { ok: false, reason: "signature_malformed" };
  }
  const provided = envelope.signature.slice(prefix.length);
  if (provided.length === 0 || !/^[0-9a-f]+$/.test(provided)) {
    return { ok: false, reason: "signature_malformed" };
  }

  const signedAtMs = Date.parse(envelope.timestamp);
  if (Number.isNaN(signedAtMs)) {
    return { ok: false, reason: "timestamp_malformed" };
  }

  const expected = computeHmacHex(
    sharedSecret,
    buildFadenWebhookSigningPayload(envelope),
  );
  if (!constantTimeHexEqual(provided, expected)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  // Checked only after the signature holds, so an unauthenticated caller cannot
  // probe our clock. Future-dated stamps are refused symmetrically: a skewed
  // provider clock must not widen the replay window.
  if (Math.abs(nowMs - signedAtMs) > toleranceSeconds * 1000) {
    return { ok: false, reason: "timestamp_outside_tolerance" };
  }

  return { ok: true };
}

/**
 * @deprecated Fixture-shape check only — this MUST NOT guard a real webhook
 * route. Three properties make it unsafe for live traffic: the shared secret is
 * embedded in the signature string in plaintext, only `rawBody.length` is bound
 * (so any tampered body of equal length passes), and the comparison is neither
 * constant-time nor bounded by a replay window. Use
 * {@link verifyFadenWebhookSignature} for anything reaching the network.
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
