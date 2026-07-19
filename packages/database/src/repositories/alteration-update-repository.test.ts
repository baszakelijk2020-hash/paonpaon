import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { AlterationUpdateRepository } from "./alteration-update-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type AlterationUpdateRow =
  Database["public"]["Tables"]["alteration_updates"]["Row"];

const row: AlterationUpdateRow = {
  id: "11112222-1111-1111-1111-111111111111",
  alteration_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  status: "in_progress",
  note: "Started taking in the waist.",
  staff_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("AlterationUpdateRepository", () => {
  it("maps a list of rows in findByAlteration()", async () => {
    const repo = new AlterationUpdateRepository(
      clientReturning({ data: [row], error: null }),
    );
    const updates = await repo.findByAlteration(row.alteration_id as never);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.status).toBe("in_progress");
    expect(updates[0]?.note).toBe("Started taking in the waist.");
  });

  it("add() maps the inserted row back to a domain AlterationUpdate", async () => {
    const repo = new AlterationUpdateRepository(
      clientReturning({ data: row, error: null }),
    );
    const update = await repo.add({
      alterationId: row.alteration_id as never,
      retailerId: row.retailer_id as never,
      status: "in_progress",
      note: "Started taking in the waist.",
    });
    expect(update.status).toBe("in_progress");
  });
});
