import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "./client-type";
import { orchestrateMorningRoutineDeliveries } from "./morning-routine-delivery-orchestrator";

const NOW = "2026-08-02T12:00:00.000Z";
const TODAY = "2026-08-02";

/**
 * In-memory stand-in for a Supabase client: `.from(table)` filters a fixed
 * fixture array through `.eq`/`.in`/`.limit`, resolving via `.maybeSingle()`
 * or the thenable itself. `.rpc(name, params)` dispatches to a per-name
 * handler and records every call for assertions. Good enough for an
 * orchestrator that only ever does simple equality-filtered reads plus
 * writes through narrow RPCs — no need to reproduce full Postgrest.
 */
function createFakeClient(config: {
  readonly tables: Record<string, Record<string, unknown>[]>;
  readonly rpcHandlers: Record<
    string,
    (params: Record<string, unknown>) => unknown
  >;
}) {
  const rpcCalls: { name: string; params: Record<string, unknown> }[] = [];

  function from(table: string) {
    let rows = [...(config.tables[table] ?? [])];
    const chain = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        rows = rows.filter((row) => row[col] === val);
        return chain;
      },
      in: (col: string, vals: readonly unknown[]) => {
        rows = rows.filter((row) => vals.includes(row[col]));
        return chain;
      },
      order: () => chain,
      limit: (n: number) => {
        rows = rows.slice(0, n);
        return chain;
      },
      maybeSingle: () =>
        Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (onFulfilled: (v: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(onFulfilled),
    };
    return chain;
  }

  function rpc(name: string, params: Record<string, unknown>) {
    rpcCalls.push({ name, params });
    const handler = config.rpcHandlers[name];
    return Promise.resolve({
      data: handler ? handler(params) : null,
      error: null,
    });
  }

  return {
    client: { from, rpc } as unknown as PaonSupabaseClient,
    rpcCalls,
  };
}

function subscriptionRow(args: {
  readonly retailerId: string;
  readonly customerId: string;
  readonly channels: readonly string[];
}) {
  return {
    id: `sub-${args.customerId}`,
    retailer_id: args.retailerId,
    customer_id: args.customerId,
    opted_in: true,
    opted_in_at: NOW,
    opted_out_at: null,
    frequency: "daily",
    timezone: "UTC",
    quiet_start_minute: null,
    quiet_end_minute: null,
    channels: args.channels,
    preferred_local_hour: 0,
    created_at: NOW,
    updated_at: NOW,
  };
}

function selectionRow(args: {
  readonly id: string;
  readonly retailerId: string;
  readonly customerId: string;
}) {
  return {
    id: args.id,
    retailer_id: args.retailerId,
    customer_id: args.customerId,
    for_date: TODAY,
    summary: "A crisp look for a mild morning.",
    review_status: "unreviewed",
    created_at: NOW,
    personalization_consent: "granted",
    location_consent: "granted",
    personalization_status: "used",
    location_status: "used",
    location_kind: "store_city",
    location_label: "Blaricum",
    weather_status: "used",
    weather_summary: "12°C, light rain",
    calendar_status: "used",
    occasion_labels: [],
  };
}

describe("orchestrateMorningRoutineDeliveries", () => {
  it("skips a retailer whose morning_routine_delivery job is disabled without touching any other table", async () => {
    const { client, rpcCalls } = createFakeClient({
      tables: {
        morning_routine_subscriptions: [
          subscriptionRow({
            retailerId: "retailer-off",
            customerId: "customer-off",
            channels: ["in_app"],
          }),
        ],
      },
      rpcHandlers: {
        retailer_module_job_enabled: () => false,
      },
    });

    const result = await orchestrateMorningRoutineDeliveries(client, NOW);

    expect(result).toEqual({
      considered: 1,
      queued: 0,
      skipped: 1,
      failed: 0,
    });
    expect(
      rpcCalls.filter(
        (c) => c.name === "record_morning_routine_delivery_audit",
      ),
    ).toHaveLength(0);
  });

  it("records a skipped_retailer_paused audit and enqueues nothing when the retailer has paused delivery", async () => {
    const { client, rpcCalls } = createFakeClient({
      tables: {
        morning_routine_subscriptions: [
          subscriptionRow({
            retailerId: "retailer-paused",
            customerId: "customer-paused",
            channels: ["email"],
          }),
        ],
        morning_routine_retailer_settings: [
          { retailer_id: "retailer-paused", paused: true, updated_at: NOW },
        ],
      },
      rpcHandlers: {
        retailer_module_job_enabled: () => true,
        record_morning_routine_delivery_audit: () => "audit-paused",
      },
    });

    const result = await orchestrateMorningRoutineDeliveries(client, NOW);

    expect(result).toEqual({
      considered: 1,
      queued: 0,
      skipped: 1,
      failed: 0,
    });
    const auditCalls = rpcCalls.filter(
      (c) => c.name === "record_morning_routine_delivery_audit",
    );
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.params).toMatchObject({
      p_outcome: "skipped_retailer_paused",
      p_suppression_reason: "retailer_paused",
    });
    expect(
      rpcCalls.filter(
        (c) => c.name === "enqueue_morning_routine_delivery_notification",
      ),
    ).toHaveLength(0);
  });

  it("enqueues a notification per subscribed channel and records the audit from the exact persisted selection", async () => {
    const { client, rpcCalls } = createFakeClient({
      tables: {
        morning_routine_subscriptions: [
          subscriptionRow({
            retailerId: "retailer-live",
            customerId: "customer-live",
            channels: ["in_app", "email"],
          }),
        ],
        morning_routine_selections: [
          selectionRow({
            id: "selection-1",
            retailerId: "retailer-live",
            customerId: "customer-live",
          }),
        ],
        morning_routine_recommendations: [
          {
            id: "rec-1",
            selection_id: "selection-1",
            rank: 1,
            source: "owned",
            display_name: "Navy wool suit",
            score: 0.9,
            explanation: [],
            factors: [],
            actions: [],
          },
        ],
      },
      rpcHandlers: {
        retailer_module_job_enabled: () => true,
        enqueue_morning_routine_delivery_notification: () => "notification-1",
        record_morning_routine_delivery_audit: () => "audit-1",
      },
    });

    const result = await orchestrateMorningRoutineDeliveries(client, NOW);

    expect(result).toEqual({
      considered: 1,
      queued: 1,
      skipped: 0,
      failed: 0,
    });

    const enqueueCalls = rpcCalls.filter(
      (c) => c.name === "enqueue_morning_routine_delivery_notification",
    );
    expect(enqueueCalls).toHaveLength(2);
    expect(enqueueCalls.map((c) => c.params.p_channel)).toEqual([
      "in_app",
      "email",
    ]);

    const auditCalls = rpcCalls.filter(
      (c) => c.name === "record_morning_routine_delivery_audit",
    );
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.params).toMatchObject({
      p_selection_id: "selection-1",
      p_notification_id: "notification-1",
      p_outcome: "queued_email",
    });
  });

  it("does not enqueue a duplicate delivery for a customer already delivered to today", async () => {
    const { client, rpcCalls } = createFakeClient({
      tables: {
        morning_routine_subscriptions: [
          subscriptionRow({
            retailerId: "retailer-dup",
            customerId: "customer-dup",
            channels: ["in_app"],
          }),
        ],
        morning_routine_delivery_audits: [
          {
            id: "audit-existing",
            customer_id: "customer-dup",
            for_date: TODAY,
            outcome: "queued_in_app",
          },
        ],
      },
      rpcHandlers: {
        retailer_module_job_enabled: () => true,
        record_morning_routine_delivery_audit: () => "audit-2",
      },
    });

    const result = await orchestrateMorningRoutineDeliveries(client, NOW);

    expect(result).toEqual({
      considered: 1,
      queued: 0,
      skipped: 1,
      failed: 0,
    });
    const auditCalls = rpcCalls.filter(
      (c) => c.name === "record_morning_routine_delivery_audit",
    );
    expect(auditCalls[0]?.params).toMatchObject({
      p_outcome: "skipped_duplicate",
      p_suppression_reason: "duplicate_for_date",
    });
  });
});
