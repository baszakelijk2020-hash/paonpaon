import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { AlterationRepository } from "./alteration-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type WorkOrderRow =
  Database["public"]["Tables"]["alteration_work_orders"]["Row"];
type WorkerWorkOrderRow =
  Database["public"]["Views"]["worker_alteration_work_orders"]["Row"];

const row: WorkOrderRow = {
  id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  customer_id: "44444444-4444-4444-4444-444444444444",
  physical_garment_id: "55555555-5555-5555-5555-555555555555",
  fitting_session_id: null,
  work_order_number: "ALT-000001",
  status: "intake",
  original_quote_amount_minor_units: 12500,
  original_quote_currency: "GBP",
  agreed_total_amount_minor_units: null,
  agreed_total_currency: null,
  due_date: null,
  customer_notification_ready_at: null,
  customer_notified_at: null,
  canceled_at: null,
  cancellation_reason: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

const workerRow: WorkerWorkOrderRow = {
  id: row.id,
  retailer_id: row.retailer_id,
  physical_garment_id: row.physical_garment_id,
  work_order_number: row.work_order_number,
  status: "assigned",
  category_code: "jacket",
  garment_type: "Single-breasted jacket",
  brand: "PAON House",
  description: "Navy hopsack jacket",
  intake_condition: "Clean with light cuff wear",
  due_date: null,
  created_at: row.created_at,
  updated_at: row.updated_at,
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
  it("maps Money and garment ownership from a work order", async () => {
    const workOrder = await new AlterationRepository(
      clientReturning({ data: row, error: null }),
    ).findById(row.id as never);
    expect(workOrder?.workOrderNumber).toBe("ALT-000001");
    expect(workOrder?.originalQuote).toEqual({
      amountMinorUnits: 12500,
      currency: "GBP",
    });
    expect(workOrder?.physicalGarmentId).toBe(row.physical_garment_id);
  });

  it("returns retailer work orders newest-first", async () => {
    const workOrders = await new AlterationRepository(
      clientReturning({ data: [row], error: null }),
    ).findByRetailer(row.retailer_id as never);
    expect(workOrders).toHaveLength(1);
  });

  it("maps the worker-safe garment projection without customer or pricing fields", async () => {
    const workOrder = await new AlterationRepository(
      clientReturning({ data: workerRow, error: null }),
    ).findByIdForWorker(workerRow.id as never);

    expect(workOrder).toMatchObject({
      garmentType: "Single-breasted jacket",
      garmentDescription: "Navy hopsack jacket",
      intakeCondition: "Clean with light cuff wear",
    });
    expect(workOrder).not.toHaveProperty("customerId");
    expect(workOrder).not.toHaveProperty("originalQuote");
  });
});
