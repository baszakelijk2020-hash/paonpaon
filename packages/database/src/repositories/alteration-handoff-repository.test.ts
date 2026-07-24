import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { AlterationHandoffRepository } from "./alteration-handoff-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type FulfillmentRow =
  Database["public"]["Tables"]["alteration_fulfillment_events"]["Row"];

const fulfillmentRow: FulfillmentRow = {
  id: "11111111-1111-1111-1111-111111111111",
  alteration_id: "22222222-2222-2222-2222-222222222222",
  retailer_id: "33333333-3333-3333-3333-333333333333",
  actor_staff_id: "44444444-4444-4444-4444-444444444444",
  method: "pickup",
  status: "completed",
  scheduled_at: "2026-07-24T09:00:00.000Z",
  completed_at: "2026-07-24T09:05:00.000Z",
  delivery_address: null,
  released_to_name: "Alex Client",
  verification_note: "Photo ID checked",
  created_at: "2026-07-24T09:05:00.000Z",
  updated_at: "2026-07-24T09:05:00.000Z",
  deleted_at: null,
};

describe("AlterationHandoffRepository", () => {
  it("maps fulfillment employee attribution", async () => {
    const from = vi
      .fn()
      .mockReturnValue(
        fakeQueryBuilder({ data: [fulfillmentRow], error: null }),
      );

    const result = await new AlterationHandoffRepository({
      from,
    } as unknown as PaonSupabaseClient).findFulfillment(
      fulfillmentRow.alteration_id as never,
    );

    expect(result).toEqual([
      expect.objectContaining({
        actorStaffId: fulfillmentRow.actor_staff_id,
        releasedToName: "Alex Client",
        verificationNote: "Photo ID checked",
      }),
    ]);
  });

  it("supports explicit attribution for service-role internal callers", async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn().mockReturnValue({ insert });

    await new AlterationHandoffRepository({
      from,
    } as unknown as PaonSupabaseClient).recordFulfillment({
      alterationId: fulfillmentRow.alteration_id as never,
      retailerId: fulfillmentRow.retailer_id as never,
      actorStaffId: fulfillmentRow.actor_staff_id as never,
      method: "pickup",
      status: "completed",
      releasedToName: "Alex Client",
      verificationNote: "Photo ID checked",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_staff_id: fulfillmentRow.actor_staff_id,
      }),
    );
  });
});
