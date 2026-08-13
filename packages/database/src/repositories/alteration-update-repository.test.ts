import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { AlterationUpdateRepository } from "./alteration-update-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type HistoryRow =
  Database["public"]["Tables"]["alteration_status_history"]["Row"];

const row: HistoryRow = {
  id: "11112222-1111-1111-1111-111111111111",
  alteration_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  from_status: "assigned",
  to_status: "in_progress",
  note: "Work started.",
  actor_staff_id: null,
  actor_user_id: null,
  customer_visible: false,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("AlterationUpdateRepository", () => {
  it("maps append-only transition history", async () => {
    const client = {
      from: () => fakeQueryBuilder({ data: [row], error: null }),
    } as unknown as PaonSupabaseClient;
    const updates = await new AlterationUpdateRepository(
      client,
    ).findByAlteration(row.alteration_id as never);
    expect(updates[0]?.fromStatus).toBe("assigned");
    expect(updates[0]?.toStatus).toBe("in_progress");
    expect(updates[0]?.customerVisible).toBe(false);
  });

  it("notifyCustomer threads a status update into the staff conversation and stamps notified", async () => {
    const rpcCalls: { fn: string; args: unknown }[] = [];
    const client = {
      from: (table: string) => {
        if (table === "alteration_work_orders") {
          return fakeQueryBuilder({
            data: {
              customer_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
              work_order_number: "WO-0042",
            },
            error: null,
          });
        }
        throw new Error(`unexpected table ${table}`);
      },
      rpc: (fn: string, args: unknown) => {
        rpcCalls.push({ fn, args });
        if (fn === "get_or_create_staff_conversation") {
          return Promise.resolve({
            data: "22223333-2222-2222-2222-222222222222",
            error: null,
          });
        }
        if (fn === "send_conversation_message") {
          return Promise.resolve({
            data: "44445555-4444-4444-4444-444444444444",
            error: null,
          });
        }
        if (fn === "mark_alteration_customer_notified") {
          return Promise.resolve({ data: null, error: null });
        }
        throw new Error(`unexpected rpc ${fn}`);
      },
    } as unknown as PaonSupabaseClient;

    const result = await new AlterationUpdateRepository(client).notifyCustomer({
      alterationId: row.alteration_id as never,
      toStatus: "ready_for_pickup",
      note: "Collect anytime this week.",
    });

    expect(result).toEqual({ notified: true });
    expect(rpcCalls.map((c) => c.fn)).toEqual([
      "get_or_create_staff_conversation",
      "send_conversation_message",
      "mark_alteration_customer_notified",
    ]);
    expect(rpcCalls[1]?.args).toEqual({
      p_conversation_id: "22223333-2222-2222-2222-222222222222",
      p_body:
        "Update on your alteration (WO-0042): Ready for collection. Collect anytime this week.",
    });
    expect(rpcCalls[2]?.args).toEqual({
      p_alteration_id: row.alteration_id,
    });
  });

  it("notifyCustomer quietly no-ops when the caller cannot message customers", async () => {
    const client = {
      from: () =>
        fakeQueryBuilder({
          data: {
            customer_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
            work_order_number: "WO-0042",
          },
          error: null,
        }),
      rpc: (fn: string) => {
        if (fn === "get_or_create_staff_conversation") {
          return Promise.resolve({
            data: null,
            error: { message: "Not authorized" },
          });
        }
        throw new Error(`unexpected rpc ${fn}`);
      },
    } as unknown as PaonSupabaseClient;

    const result = await new AlterationUpdateRepository(client).notifyCustomer({
      alterationId: row.alteration_id as never,
      toStatus: "ready_for_pickup",
    });
    expect(result).toEqual({ notified: false });
  });
});
