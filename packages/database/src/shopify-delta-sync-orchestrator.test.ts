import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "./client-type";
import { orchestrateShopifyDeltaSync } from "./shopify-delta-sync-orchestrator";

const retailerId = asId<"RetailerId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const connectionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type QueryResult = { data: unknown; error: null | { message: string } };

function createBuilder(resolve: () => QueryResult) {
  const builder: Record<string, unknown> = {};
  const self = new Proxy(builder, {
    get(target, prop) {
      if (prop === "then") {
        return (onFulfilled: (v: QueryResult) => unknown) =>
          Promise.resolve(resolve()).then(onFulfilled);
      }
      if (!(prop in target)) {
        target[prop as string] = vi.fn(() => self);
      }
      return target[prop as string];
    },
  });
  return self;
}

function createMockClient(operationalState: "active" | "paused") {
  const calls: Array<{ table: string; op: string }> = [];

  const from = vi.fn((table: string) => {
    const builder = createBuilder(() => {
      if (table === "integration_connections") {
        return { data: { operational_state: operationalState }, error: null };
      }
      if (table === "integration_sync_runs") {
        return {
          data: {
            id: "run-1",
            retailer_id: retailerId,
            connection_id: connectionId,
            trigger_kind: "scheduled",
            status: "running",
            started_at: "2026-08-01T00:00:00.000Z",
            records_processed: 0,
            records_failed: 0,
          },
          error: null,
        };
      }
      if (table === "migration_jobs") {
        return {
          data: {
            id: "job-1",
            retailer_id: retailerId,
            display_name: "Shopify delta sync",
            status: "dry_run",
            contract_version: "v1",
            created_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-01T00:00:00.000Z",
          },
          error: null,
        };
      }
      if (table === "migration_staged_rows") {
        return { data: [], error: null };
      }
      if (table === "migration_publish_receipts") {
        return { data: [], error: null };
      }
      if (table === "integration_sync_cursors") {
        return {
          data: {
            id: "cursor-1",
            retailer_id: retailerId,
            connection_id: connectionId,
            resource: "shopify-delta",
            cursor_value: {},
          },
          error: null,
        };
      }
      if (table === "integration_dead_letters") {
        return {
          data: {
            id: "dl-1",
            retailer_id: retailerId,
            connection_id: connectionId,
            failure_reason: "downstream_error",
            failure_detail: {},
            retry_count: 0,
            first_failed_at: "2026-08-01T00:00:00.000Z",
            last_attempted_at: "2026-08-01T00:00:00.000Z",
          },
          error: null,
        };
      }
      if (table === "integration_reconciliation_reports") {
        return {
          data: {
            id: "reconciliation-1",
            retailer_id: retailerId,
            connection_id: connectionId,
            run_id: "run-1",
            resource: "product",
            matched_count: 1,
            conflict_count: 0,
            stale_count: 0,
            dead_letter_count: 0,
            created_at: "2026-08-01T00:00:00.000Z",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    calls.push({ table, op: "call" });
    return builder;
  });

  return { client: { from } as unknown as PaonSupabaseClient, calls };
}

describe("orchestrateShopifyDeltaSync", () => {
  it("refuses to sync a paused connection and dead-letters it", async () => {
    const { client } = createMockClient("paused");
    const result = await orchestrateShopifyDeltaSync(client, {
      retailerId,
      connectionId,
    });
    expect(result.status).toBe("failed");
    expect(result.errorSummary).toBe("connection is not active");
    expect(result.jobId).toBe("");
  });

  it("runs the delta through the real staged-file pipeline for an active connection", async () => {
    const { client, calls } = createMockClient("active");
    const result = await orchestrateShopifyDeltaSync(client, {
      retailerId,
      connectionId,
    });
    expect(result.status).toBe("succeeded");
    expect(result.jobId).toBe("job-1");
    expect(result.recordsProcessed).toBeGreaterThan(0);
    expect(calls.some((c) => c.table === "migration_jobs")).toBe(true);
    expect(calls.some((c) => c.table === "migration_staged_rows")).toBe(true);
    expect(calls.some((c) => c.table === "integration_sync_cursors")).toBe(
      true,
    );
  });
});
