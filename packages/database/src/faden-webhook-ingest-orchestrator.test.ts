import { asId, type SourceAuthorityPolicy } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "./client-type";
import { ingestFadenWebhook } from "./faden-webhook-ingest-orchestrator";

const retailerId = asId<"RetailerId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const connectionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const policy: SourceAuthorityPolicy = {
  id: "policy-1",
  retailerId,
  connectionId,
  domain: "order",
  fieldGroup: "order.status",
  authority: "external",
  allowedDirections: ["ingest"],
  mappingVersion: "faden-webhook-adapter-v1",
  createdAt: "2026-07-30T11:00:00.000Z",
  updatedAt: "2026-07-30T11:00:00.000Z",
};

const envelope = {
  providerEventId: "faden_wh_1",
  signature: "faden-hmac-sha256-v1=deadbeef",
  timestamp: "2026-07-31T00:00:00.000Z",
  rawBody: JSON.stringify({ id: "FAD-ORD-1", type: "order.updated" }),
};

/** Table-dispatching mock so both repositories share one fake client. */
function createMockClient(rows: {
  operationalState?: "active" | "paused" | "disconnected";
  existingIdentity?: { canonicalId: string } | null;
  ingestOk?: boolean;
}) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];

  function builderFor(table: string) {
    const state = {
      resolved: undefined as unknown,
    };
    const builder: Record<string, unknown> = {};
    const self = new Proxy(builder, {
      get(target, prop) {
        if (prop === "then") {
          return (onFulfilled: (v: unknown) => unknown) =>
            Promise.resolve(state.resolved).then(onFulfilled);
        }
        if (prop === "insert" || prop === "update" || prop === "upsert") {
          return vi.fn((payload: unknown) => {
            calls.push({ table, op: String(prop), payload });
            if (table === "integration_sync_runs" && prop === "insert") {
              state.resolved = {
                data: {
                  id: "run-1",
                  retailer_id: retailerId,
                  connection_id: connectionId,
                  trigger_kind: "webhook",
                  status: "running",
                  started_at: envelope.timestamp,
                  records_processed: 0,
                  records_failed: 0,
                },
                error: null,
              };
            } else if (table === "integration_sync_runs" && prop === "update") {
              state.resolved = {
                data: {
                  id: "run-1",
                  retailer_id: retailerId,
                  connection_id: connectionId,
                  trigger_kind: "webhook",
                  status: (payload as { status: string }).status,
                  started_at: envelope.timestamp,
                  finished_at: envelope.timestamp,
                  records_processed: 0,
                  records_failed: 0,
                },
                error: null,
              };
            } else if (table === "integration_dead_letters") {
              state.resolved = {
                data: {
                  id: "dl-1",
                  retailer_id: retailerId,
                  connection_id: connectionId,
                  failure_reason: (payload as { failure_reason: string })
                    .failure_reason,
                  failure_detail: {},
                  retry_count: 0,
                  first_failed_at: envelope.timestamp,
                  last_attempted_at: envelope.timestamp,
                },
                error: null,
              };
            } else if (table === "integration_sync_cursors") {
              state.resolved = {
                data: {
                  id: "cursor-1",
                  retailer_id: retailerId,
                  connection_id: connectionId,
                  resource: "order",
                  cursor_value: {},
                },
                error: null,
              };
            } else if (
              table === "integration_raw_events" &&
              prop === "insert"
            ) {
              state.resolved = {
                data: {
                  id: "raw-1",
                  retailer_id: retailerId,
                  connection_id: connectionId,
                  provider_event_id: envelope.providerEventId,
                  payload_hash: "sha256:test",
                  payload: {},
                  received_at: envelope.timestamp,
                  mapping_version: policy.mappingVersion,
                  direction: "ingest",
                },
                error: null,
              };
            } else if (
              table === "external_identities" &&
              (prop === "insert" || prop === "update")
            ) {
              state.resolved = {
                data: {
                  id: "identity-1",
                  retailer_id: retailerId,
                  connection_id: connectionId,
                  domain: "order",
                  external_object_type: "order",
                  external_id: "FAD-ORD-1",
                  canonical_object_type: "order",
                  canonical_id:
                    rows.existingIdentity?.canonicalId ?? "canonical-order-1",
                  mapping_version: policy.mappingVersion,
                  reconciliation_status:
                    rows.ingestOk === false ? "conflict" : "matched",
                },
                error: null,
              };
            } else if (
              table === "integration_connections" &&
              prop === "update"
            ) {
              // markConnectionHealth's write — only its `error` field is
              // read by the caller, so an empty success envelope is enough.
              state.resolved = { data: null, error: null };
            } else if (
              table === "integration_reconciliation_reports" &&
              prop === "insert"
            ) {
              const p = payload as Record<string, unknown>;
              state.resolved = {
                data: {
                  id: "reconciliation-1",
                  retailer_id: p["retailer_id"],
                  connection_id: p["connection_id"],
                  run_id: p["run_id"] ?? null,
                  resource: p["resource"],
                  matched_count: p["matched_count"],
                  conflict_count: p["conflict_count"],
                  stale_count: p["stale_count"],
                  dead_letter_count: p["dead_letter_count"],
                  created_at: envelope.timestamp,
                },
                error: null,
              };
            }
            return self;
          });
        }
        if (!(prop in target)) {
          target[prop as string] = vi.fn(() => self);
        }
        return target[prop as string];
      },
    });
    return self;
  }

  const from = vi.fn((table: string) => {
    const builder = builderFor(table) as Record<string, unknown> & {
      then: unknown;
    };
    if (table === "integration_connections") {
      // Overwrite the terminal resolution for a plain
      // select().eq()...().single()/maybeSingle() chain.
      const proxied = builder as unknown as Record<
        string,
        (...args: unknown[]) => unknown
      >;
      const resolved = () =>
        Promise.resolve({
          data: {
            id: connectionId,
            retailer_id: retailerId,
            operational_state: rows.operationalState ?? "active",
          },
          error: null,
        });
      proxied["single"] = vi.fn(resolved);
      proxied["maybeSingle"] = vi.fn(resolved);
    }
    if (table === "external_identities") {
      const proxied = builder as unknown as {
        [key: string]: (...a: unknown[]) => unknown;
      };
      proxied["maybeSingle"] = vi.fn(() =>
        Promise.resolve({
          data: rows.existingIdentity
            ? {
                id: "identity-existing",
                retailer_id: retailerId,
                connection_id: connectionId,
                domain: "order",
                external_object_type: "order",
                external_id: "FAD-ORD-1",
                canonical_object_type: "order",
                canonical_id: rows.existingIdentity.canonicalId,
                mapping_version: policy.mappingVersion,
                reconciliation_status: "matched",
              }
            : null,
          error: null,
        }),
      );
    }
    if (table === "integration_raw_events") {
      // ingestFadenReadOnly's own idempotency read — every event in these
      // tests is a fresh delivery, never a replay of an already-stored one.
      const proxied = builder as unknown as {
        [key: string]: (...a: unknown[]) => unknown;
      };
      proxied["maybeSingle"] = vi.fn(() =>
        Promise.resolve({ data: null, error: null }),
      );
    }
    return builder;
  });

  return { client: { from } as unknown as PaonSupabaseClient, calls };
}

describe("ingestFadenWebhook", () => {
  it("dead-letters and refuses ingest when the connection is not active", async () => {
    const { client, calls } = createMockClient({ operationalState: "paused" });

    const result = await ingestFadenWebhook(client, {
      retailerId,
      connectionId,
      policy,
      envelope,
      verification: { ok: true },
      payloadHash: "sha256:test",
      externalObjectType: "order",
      externalId: "FAD-ORD-1",
      canonicalObjectType: "order",
      canonicalId: "canonical-order-1",
      mappingVersion: policy.mappingVersion,
    });

    expect(result).toEqual({
      ok: false,
      runId: "run-1",
      reason: "connection_not_active",
    });
    expect(
      calls.some(
        (c) =>
          c.table === "integration_dead_letters" &&
          (c.payload as { failure_reason: string }).failure_reason ===
            "downstream_error",
      ),
    ).toBe(true);
  });

  it("dead-letters a rejected signature without ever calling source-authority ingest", async () => {
    const { client, calls } = createMockClient({ operationalState: "active" });

    const result = await ingestFadenWebhook(client, {
      retailerId,
      connectionId,
      policy,
      envelope,
      verification: { ok: false, reason: "signature_mismatch" },
      payloadHash: "sha256:test",
      externalObjectType: "order",
      externalId: "FAD-ORD-1",
      canonicalObjectType: "order",
      canonicalId: "canonical-order-1",
      mappingVersion: policy.mappingVersion,
    });

    expect(result).toEqual({
      ok: false,
      runId: "run-1",
      reason: "signature_rejected",
      detail: "signature_mismatch",
    });
    expect(calls.some((c) => c.table === "integration_raw_events")).toBe(false);
  });

  it("classifies an expired replay window as replay_rejected, not signature_invalid", async () => {
    const { client, calls } = createMockClient({ operationalState: "active" });

    await ingestFadenWebhook(client, {
      retailerId,
      connectionId,
      policy,
      envelope,
      verification: { ok: false, reason: "timestamp_outside_tolerance" },
      payloadHash: "sha256:test",
      externalObjectType: "order",
      externalId: "FAD-ORD-1",
      canonicalObjectType: "order",
      canonicalId: "canonical-order-1",
      mappingVersion: policy.mappingVersion,
    });

    expect(
      calls.some(
        (c) =>
          c.table === "integration_dead_letters" &&
          (c.payload as { failure_reason: string }).failure_reason ===
            "replay_rejected",
      ),
    ).toBe(true);
  });

  it("refuses to invent a canonical mapping for a never-seen external order", async () => {
    const { client, calls } = createMockClient({
      operationalState: "active",
      existingIdentity: null,
    });

    const result = await ingestFadenWebhook(client, {
      retailerId,
      connectionId,
      policy,
      envelope,
      verification: { ok: true },
      payloadHash: "sha256:test",
      externalObjectType: "order",
      externalId: "FAD-ORD-1",
      canonicalObjectType: "order",
      // canonicalId deliberately omitted — nothing maps this yet.
      mappingVersion: policy.mappingVersion,
    });

    expect(result).toEqual({
      ok: false,
      runId: "run-1",
      reason: "unmapped_external_object",
    });
    expect(
      calls.some(
        (c) =>
          c.table === "integration_dead_letters" &&
          (c.payload as { failure_detail: { reason: string } }).failure_detail
            .reason === "unmapped_external_object",
      ),
    ).toBe(true);
    expect(calls.some((c) => c.table === "integration_raw_events")).toBe(false);
  });

  it("resolves an existing mapping instead of requiring the caller to supply one", async () => {
    const { client } = createMockClient({
      operationalState: "active",
      existingIdentity: { canonicalId: "canonical-order-9" },
    });

    const result = await ingestFadenWebhook(client, {
      retailerId,
      connectionId,
      policy,
      envelope,
      verification: { ok: true },
      payloadHash: "sha256:test",
      externalObjectType: "order",
      externalId: "FAD-ORD-1",
      canonicalObjectType: "order",
      mappingVersion: policy.mappingVersion,
    });

    expect(result.ok).toBe(true);
  });

  it("accepts a signed, mapped, active-connection event end to end", async () => {
    const { client, calls } = createMockClient({ operationalState: "active" });

    const result = await ingestFadenWebhook(client, {
      retailerId,
      connectionId,
      policy,
      envelope,
      verification: { ok: true },
      payloadHash: "sha256:test",
      externalObjectType: "order",
      externalId: "FAD-ORD-1",
      canonicalObjectType: "order",
      canonicalId: "canonical-order-1",
      mappingVersion: policy.mappingVersion,
    });

    expect(result).toEqual({
      ok: true,
      runId: "run-1",
      identityId: "identity-1",
    });
    expect(
      calls.some(
        (c) =>
          c.table === "integration_sync_runs" &&
          c.op === "update" &&
          (c.payload as { status: string }).status === "succeeded",
      ),
    ).toBe(true);
    expect(calls.some((c) => c.table === "integration_sync_cursors")).toBe(
      true,
    );
  });
});
