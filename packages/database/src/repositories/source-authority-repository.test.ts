import { asId, buildFadenFixtureIngestInput } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { SourceAuthorityRepository } from "./source-authority-repository";

const retailerA = asId<"RetailerId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const retailerB = asId<"RetailerId">("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
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
    is: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };
}

describe("SourceAuthorityRepository tenant scoping", () => {
  it("scopes connection listing to the requested retailer", async () => {
    const from = vi.fn(() => createBuilder(() => ({ data: [], error: null })));
    const repo = new SourceAuthorityRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await repo.listConnections(retailerA);

    expect(from).toHaveBeenCalledWith("integration_connections");
    const builder = from.mock.results[0]?.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.eq).toHaveBeenCalledWith("retailer_id", retailerA);
  });

  it("denies cross-tenant identity lookup by requiring retailer_id", async () => {
    const from = vi.fn(() =>
      createBuilder(() => ({ data: null, error: null })),
    );
    const repo = new SourceAuthorityRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await repo.findIdentityByExternal({
      retailerId: retailerB,
      connectionId,
      domain: "order",
      externalObjectType: "order",
      externalId: "FAD-ORD-1001",
    });

    const builder = from.mock.results[0]?.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.eq).toHaveBeenCalledWith("retailer_id", retailerB);
    expect(builder.eq).toHaveBeenCalledWith("connection_id", connectionId);
  });

  it("records writeBackClaimed false on successful Faden fixture ingest path", async () => {
    const rawEventQueues = [
      { data: null, error: null },
      {
        data: {
          id: "raw-1",
          retailer_id: retailerA,
          connection_id: connectionId,
          provider_event_id: "faden_evt_fixture_order_1001",
          payload_hash: "sha256:x",
          payload: {},
          received_at: "2026-07-30T10:15:00.000Z",
          mapping_version: "faden-readonly-v1",
          direction: "ingest",
          created_at: "2026-07-30T10:15:00.000Z",
        },
        error: null,
      },
    ];
    const identityQueues = [
      { data: null, error: null },
      {
        data: {
          id: "id-1",
          retailer_id: retailerA,
          connection_id: connectionId,
          domain: "order",
          external_object_type: "order",
          external_id: "FAD-ORD-1001",
          canonical_object_type: "order",
          canonical_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          external_version: null,
          external_updated_at: "2026-07-30T10:14:42.000Z",
          raw_event_id: "raw-1",
          mapping_version: "faden-readonly-v1",
          reconciliation_status: "matched",
          conflict_summary: null,
          created_at: "2026-07-30T10:15:00.000Z",
          updated_at: "2026-07-30T10:15:00.000Z",
          deleted_at: null,
        },
        error: null,
      },
    ];

    const from = vi.fn((table: string) => {
      if (table === "integration_raw_events") {
        return createBuilder(() => {
          const next = rawEventQueues.shift();
          return next ?? { data: null, error: { message: "raw queue empty" } };
        });
      }
      if (table === "external_identities") {
        return createBuilder(() => {
          const next = identityQueues.shift();
          return (
            next ?? { data: null, error: { message: "identity queue empty" } }
          );
        });
      }
      if (table === "integration_handoff_tasks") {
        return createBuilder(() => ({
          data: {
            id: "hand-1",
            retailer_id: retailerA,
            connection_id: connectionId,
            external_object_type: "order",
            external_id: "FAD-ORD-1001",
            deep_link_url: "https://app.faden.example/orders/FAD-ORD-1001",
            write_back_claimed: false,
            instruction: "Open the Faden record",
            status: "open",
            created_at: "2026-07-30T10:15:00.000Z",
            updated_at: "2026-07-30T10:15:00.000Z",
          },
          error: null,
        }));
      }
      return createBuilder(() => ({ data: null, error: null }));
    });

    const repo = new SourceAuthorityRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const result = await repo.ingestFadenReadOnly(
      buildFadenFixtureIngestInput({
        retailerId: retailerA,
        connectionId,
        canonicalOrderId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      }),
      { id: "FAD-ORD-1001" },
    );

    expect(result.writeBackClaimed).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.handoff?.writeBackClaimed).toBe(false);
    expect(result.idempotentReplay).toBe(false);
    expect(from).toHaveBeenCalledWith("integration_raw_events");
    expect(from).toHaveBeenCalledWith("integration_handoff_tasks");
  });

  it("returns idempotent replay without claiming write-back", async () => {
    const from = vi.fn((table: string) => {
      if (table === "integration_raw_events") {
        return createBuilder(() => ({
          data: {
            id: "raw-1",
            retailer_id: retailerA,
            connection_id: connectionId,
            provider_event_id: "faden_evt_fixture_order_1001",
            payload_hash: "sha256:x",
            payload: {},
            received_at: "2026-07-30T10:15:00.000Z",
            mapping_version: "faden-readonly-v1",
            direction: "ingest",
            created_at: "2026-07-30T10:15:00.000Z",
          },
          error: null,
        }));
      }
      return createBuilder(() => ({
        data: {
          id: "id-1",
          retailer_id: retailerA,
          connection_id: connectionId,
          domain: "order",
          external_object_type: "order",
          external_id: "FAD-ORD-1001",
          canonical_object_type: "order",
          canonical_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          external_version: null,
          external_updated_at: "2026-07-30T10:14:42.000Z",
          raw_event_id: "raw-1",
          mapping_version: "faden-readonly-v1",
          reconciliation_status: "matched",
          conflict_summary: null,
          created_at: "2026-07-30T10:15:00.000Z",
          updated_at: "2026-07-30T10:15:00.000Z",
          deleted_at: null,
        },
        error: null,
      }));
    });

    const repo = new SourceAuthorityRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const result = await repo.ingestFadenReadOnly(
      buildFadenFixtureIngestInput({
        retailerId: retailerA,
        connectionId,
        canonicalOrderId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      }),
      { id: "FAD-ORD-1001" },
    );

    expect(result.ok).toBe(true);
    expect(result.idempotentReplay).toBe(true);
    expect(result.writeBackClaimed).toBe(false);
  });
});
