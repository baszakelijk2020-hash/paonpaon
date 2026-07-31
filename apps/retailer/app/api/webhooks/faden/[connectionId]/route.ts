import { createHash, createHmac } from "node:crypto";

import {
  IntegrationLifecycleRepository,
  SourceAuthorityRepository,
  ingestFadenWebhook,
} from "@paon/database";
import { verifyFadenWebhookSignature } from "@paon/domain";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Faden order-status webhook receiver (PHASE 9.2 / INT-004). Read-only
 * ingest only — Faden never receives a write-back, matching
 * `buildFadenDeepLinkHandoff`'s "never invent write-back" contract.
 *
 * Registered against one connection at a time via the `connectionId` in the
 * URL, since Faden's webhook subscription is configured per retailer's own
 * Faden account, not platform-wide. Route Handlers are the documented
 * exception for non-browser callers (docs/API.md) — a Server Action cannot
 * receive an inbound provider webhook.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
): Promise<Response> {
  const { connectionId } = await params;
  const admin = getSupabaseAdminClient();
  const lifecycle = new IntegrationLifecycleRepository(admin);
  const sourceAuthority = new SourceAuthorityRepository(admin);

  const connection = await lifecycle.findConnectionByIdForWebhook(connectionId);
  if (!connection) {
    // Deliberately vague — do not confirm or deny connection existence to
    // an unauthenticated caller.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const secrets = await lifecycle.listConnectionSecretRefs({
    retailerId: connection.retailerId,
    connectionId: connection.id,
  });
  const webhookSecretRow = secrets.find(
    (secret) => secret.kind === "webhook_shared_secret" && !secret.revokedAt,
  );
  const sharedSecret = env.resolveSecretRef(webhookSecretRow?.secretRef);
  if (!sharedSecret) {
    return NextResponse.json(
      {
        error:
          "Faden webhook signing secret is not configured for this connection.",
      },
      { status: 503 },
    );
  }

  const providerEventId = request.headers.get("x-faden-event-id");
  const timestamp = request.headers.get("x-faden-timestamp");
  const signature = request.headers.get("x-faden-signature");
  if (!providerEventId || !timestamp || !signature) {
    return NextResponse.json(
      {
        error:
          "Missing x-faden-event-id, x-faden-timestamp or x-faden-signature",
      },
      { status: 400 },
    );
  }

  const rawBody = await request.text();
  const envelope = { providerEventId, timestamp, signature, rawBody };

  const verification = verifyFadenWebhookSignature({
    envelope,
    sharedSecret,
    computeHmacHex: (secret, payload) =>
      createHmac("sha256", secret).update(payload).digest("hex"),
    nowMs: Date.now(),
  });

  let body: { readonly id?: unknown; readonly type?: unknown };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    body = {};
  }
  const externalId = typeof body.id === "string" ? body.id : providerEventId;

  const policies = await sourceAuthority.listPolicies(
    connection.retailerId,
    connection.id,
  );
  const orderPolicy = policies.find((policy) => policy.domain === "order");
  if (!orderPolicy) {
    return NextResponse.json(
      {
        error:
          "No order source-authority policy configured for this connection.",
      },
      { status: 503 },
    );
  }

  const payloadHash = `sha256:${createHash("sha256").update(rawBody).digest("hex")}`;

  const result = await ingestFadenWebhook(admin, {
    retailerId: connection.retailerId,
    connectionId: connection.id,
    policy: orderPolicy,
    envelope,
    verification,
    payloadHash,
    externalObjectType: "order",
    externalId,
    canonicalObjectType: "order",
    mappingVersion: orderPolicy.mappingVersion,
    triggerKind: "webhook",
  });

  if (result.ok) {
    return NextResponse.json({ status: "accepted", runId: result.runId });
  }

  const statusByReason: Record<(typeof result)["reason"], number> = {
    connection_not_active: 409,
    signature_rejected: 401,
    unmapped_external_object: 422,
    ingest_conflict: 409,
  };
  return NextResponse.json(
    { status: "rejected", reason: result.reason, detail: result.detail },
    { status: statusByReason[result.reason] },
  );
}
