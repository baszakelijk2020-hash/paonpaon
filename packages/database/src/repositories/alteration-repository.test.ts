import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { AlterationRepository } from "./alteration-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type AlterationRow = Database["public"]["Tables"]["alterations"]["Row"];

const row: AlterationRow = {
  id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  customer_id: "44444444-4444-4444-4444-444444444444",
  order_line_id: null,
  status: "requested",
  tailor_reference: null,
  instructions: "Take in the waist by 1 inch.",
  appointment_id_for_fitting: null,
  due_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("AlterationRepository", () => {
  it("maps a row to a domain Alteration, omitting null optional fields", async () => {
    const repo = new AlterationRepository(
      clientReturning({ data: row, error: null }),
    );
    const alteration = await repo.findById(row.id as never);

    expect(alteration?.instructions).toBe("Take in the waist by 1 inch.");
    expect("orderLineId" in (alteration ?? {})).toBe(false);
    expect("dueDate" in (alteration ?? {})).toBe(false);
  });

  it("maps a list of rows in findByRetailer() and findByCustomer()", async () => {
    const repo = new AlterationRepository(
      clientReturning({ data: [row], error: null }),
    );
    expect(await repo.findByRetailer(row.retailer_id as never)).toHaveLength(1);
    expect(await repo.findByCustomer(row.customer_id as never)).toHaveLength(1);
  });

  it("create() maps the inserted row back to a domain Alteration", async () => {
    const repo = new AlterationRepository(
      clientReturning({ data: row, error: null }),
    );
    const alteration = await repo.create({
      retailerId: row.retailer_id as never,
      customerId: row.customer_id as never,
      instructions: row.instructions,
    });
    expect(alteration.status).toBe("requested");
  });
});
