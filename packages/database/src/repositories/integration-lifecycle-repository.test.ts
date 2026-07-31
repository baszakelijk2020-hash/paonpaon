import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { IntegrationLifecycleRepository } from "./integration-lifecycle-repository";

const retailerA = asId<"RetailerId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const connectionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type QueryResult = { data: unknown; error: null | { message: string } };

function createBuilder(resolve: () => QueryResult) {
  const builder: Record<string, unknown> = {};
  const self = new Proxy(builder, {
    get(target, prop) {
      if (prop === "then") {
        return (onFulfilled: (value: QueryResult) => unknown) =>
          Promise.resolve(resolve()).then(onFulfilled);
      }
      if (!(prop in target)) {
        target[prop as string] = vi.fn(() => self);
      }
      return target[prop as string];
    },
  });
  return self as {
    eq: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };
}

describe("IntegrationLifecycleRepository tenant scoping", () => {
  it("scopes the operational-state fetch to the requested retailer", async () => {
    const from = vi.fn(() =>
      createBuilder(() => ({
        data: { operational_state: "active" },
        error: null,
      })),
    );
    const repo = new IntegrationLifecycleRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await repo.getOperationalState({ retailerId: retailerA, connectionId });

    expect(from).toHaveBeenCalledWith("integration_connections");
    const builder = from.mock.results[0]?.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.eq).toHaveBeenCalledWith("retailer_id", retailerA);
    expect(builder.eq).toHaveBeenCalledWith("id", connectionId);
  });

  it("rejects a same-state transition without writing anything", async () => {
    const from = vi.fn(() =>
      createBuilder(() => ({
        data: { operational_state: "active" },
        error: null,
      })),
    );
    const repo = new IntegrationLifecycleRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const result = await repo.transitionConnection({
      retailerId: retailerA,
      connectionId,
      requestedState: "active",
    });

    expect(result).toEqual({ ok: false, reason: "already_in_state" });
    // Only the fetch happened — no second call attempting an update.
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("rejects reactivating a disconnected connection without writing anything", async () => {
    const from = vi.fn(() =>
      createBuilder(() => ({
        data: { operational_state: "disconnected" },
        error: null,
      })),
    );
    const repo = new IntegrationLifecycleRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const result = await repo.transitionConnection({
      retailerId: retailerA,
      connectionId,
      requestedState: "active",
    });

    expect(result).toEqual({ ok: false, reason: "transition_not_allowed" });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("persists a legal transition scoped to the retailer", async () => {
    let updatePayload: Record<string, unknown> | undefined;
    const from = vi.fn((table: string) => {
      if (table !== "integration_connections") {
        throw new Error(`unexpected table ${table}`);
      }
      const builder = createBuilder(() => ({
        data: { operational_state: "active" },
        error: null,
      }));
      const originalUpdate = builder.update;
      builder.update = vi.fn((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return originalUpdate(payload);
      });
      return builder;
    });
    const repo = new IntegrationLifecycleRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const result = await repo.transitionConnection({
      retailerId: retailerA,
      connectionId,
      requestedState: "paused",
      reason: "operator paused for maintenance",
    });

    expect(result).toEqual({ ok: true, nextState: "paused" });
    expect(updatePayload).toMatchObject({
      operational_state: "paused",
      operational_state_reason: "operator paused for maintenance",
    });
  });

  it("scopes sync cursor upsert to (connection_id, resource) and the retailer", async () => {
    const from = vi.fn(() =>
      createBuilder(() => ({
        data: {
          id: "cursor-1",
          retailer_id: retailerA,
          connection_id: connectionId,
          resource: "orders",
          cursor_value: { since: "2026-07-01" },
          last_synced_at: "2026-07-31T00:00:00.000Z",
        },
        error: null,
      })),
    );
    const repo = new IntegrationLifecycleRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const cursor = await repo.upsertSyncCursor({
      retailerId: retailerA,
      connectionId,
      resource: "orders",
      cursorValue: { since: "2026-07-01" },
    });

    expect(cursor.resource).toBe("orders");
    expect(from).toHaveBeenCalledWith("integration_sync_cursors");
    const builder = from.mock.results[0]?.value as {
      upsert: ReturnType<typeof vi.fn>;
    };
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        retailer_id: retailerA,
        connection_id: connectionId,
        resource: "orders",
      }),
      { onConflict: "connection_id,resource" },
    );
  });

  it("scopes unresolved dead-letter listing to the retailer and connection", async () => {
    const from = vi.fn(() => createBuilder(() => ({ data: [], error: null })));
    const repo = new IntegrationLifecycleRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await repo.listUnresolvedDeadLetters({
      retailerId: retailerA,
      connectionId,
    });

    expect(from).toHaveBeenCalledWith("integration_dead_letters");
    const builder = from.mock.results[0]?.value as {
      eq: ReturnType<typeof vi.fn>;
      is: ReturnType<typeof vi.fn>;
    };
    expect(builder.eq).toHaveBeenCalledWith("retailer_id", retailerA);
    expect(builder.is).toHaveBeenCalledWith("resolved_at", null);
  });
});
