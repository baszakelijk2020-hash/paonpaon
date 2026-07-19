import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { AvailabilityWindowRepository } from "./availability-window-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type AvailabilityWindowRow =
  Database["public"]["Tables"]["availability_windows"]["Row"];

const row: AvailabilityWindowRow = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  staff_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  day_of_week: 3,
  start_time: "09:00",
  end_time: "12:00",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("AvailabilityWindowRepository", () => {
  it("maps a list of rows in findByRetailer()", async () => {
    const repo = new AvailabilityWindowRepository(
      clientReturning({ data: [row], error: null }),
    );
    const windows = await repo.findByRetailer(row.retailer_id as never);
    expect(windows).toHaveLength(1);
    expect(windows[0]?.dayOfWeek).toBe(3);
  });

  it("maps a list of rows in findByStaff()", async () => {
    const repo = new AvailabilityWindowRepository(
      clientReturning({ data: [row], error: null }),
    );
    const windows = await repo.findByStaff(row.staff_id as never);
    expect(windows).toHaveLength(1);
  });

  it("create() maps the inserted row back to a domain AvailabilityWindow", async () => {
    const repo = new AvailabilityWindowRepository(
      clientReturning({ data: row, error: null }),
    );
    const window = await repo.create({
      staffId: row.staff_id as never,
      retailerId: row.retailer_id as never,
      dayOfWeek: 3,
      startTime: "09:00",
      endTime: "12:00",
    });
    expect(window.startTime).toBe("09:00");
  });

  it("delete() rejects when the underlying query errors", async () => {
    const repo = new AvailabilityWindowRepository(
      clientReturning({
        data: null,
        error: { code: "42501", message: "permission denied" },
      }),
    );
    await expect(repo.delete(row.id as never)).rejects.toBeTruthy();
  });
});
