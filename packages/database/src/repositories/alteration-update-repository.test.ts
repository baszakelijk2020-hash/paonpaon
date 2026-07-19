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
});
