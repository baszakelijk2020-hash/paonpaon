import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { CustomerAlterationRepository } from "./customer-alteration-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type SummaryRow =
  Database["public"]["Views"]["customer_alteration_work_orders"]["Row"];

const row: SummaryRow = {
  id: "11111111-1111-1111-1111-111111111111",
  retailer_id: "22222222-2222-2222-2222-222222222222",
  customer_id: "33333333-3333-3333-3333-333333333333",
  physical_garment_id: "44444444-4444-4444-4444-444444444444",
  work_order_number: "ALT-000001",
  status: "ready_for_pickup",
  due_date: "2026-08-01",
  agreed_total_amount_minor_units: 14500,
  agreed_total_currency: "GBP",
  customer_notification_ready_at: "2026-07-20T00:00:00.000Z",
  category_code: "jacket",
  garment_type: "Single-breasted jacket",
  brand: "PAON House",
  description: "Navy hopsack jacket",
  created_at: "2026-07-19T00:00:00.000Z",
  updated_at: "2026-07-20T00:00:00.000Z",
};

describe("CustomerAlterationRepository", () => {
  it("maps only the approved customer-safe work-order projection", async () => {
    const client = {
      from: () => fakeQueryBuilder({ data: row, error: null }),
    } as unknown as PaonSupabaseClient;

    const alteration = await new CustomerAlterationRepository(client).findById(
      row.id as never,
    );

    expect(alteration).toMatchObject({
      workOrderNumber: "ALT-000001",
      garmentType: "Single-breasted jacket",
      agreedTotal: { amountMinorUnits: 14500, currency: "GBP" },
    });
    expect(alteration).not.toHaveProperty("originalQuote");
    expect(alteration).not.toHaveProperty("cancellationReason");
  });
});
