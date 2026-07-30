import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { AppointmentRepository } from "./appointment-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

const row: AppointmentRow = {
  id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
  branch_id: null,
  retailer_id: "11111111-1111-1111-1111-111111111111",
  customer_id: "44444444-4444-4444-4444-444444444444",
  staff_id: null,
  type: "styling_consultation",
  status: "requested",
  starts_at: "2026-08-01T14:00:00.000Z",
  ends_at: "2026-08-01T15:00:00.000Z",
  location_id: null,
  notes: null,
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

describe("AppointmentRepository", () => {
  it("maps a row to a domain Appointment, omitting null optional fields", async () => {
    const repo = new AppointmentRepository(
      clientReturning({ data: row, error: null }),
    );
    const appointment = await repo.findById(row.id as never);

    expect(appointment?.status).toBe("requested");
    expect("staffId" in (appointment ?? {})).toBe(false);
    expect("notes" in (appointment ?? {})).toBe(false);
  });

  it("maps a list of rows in findByRetailer() and findByCustomer()", async () => {
    const repo = new AppointmentRepository(
      clientReturning({ data: [row], error: null }),
    );
    expect(await repo.findByRetailer(row.retailer_id as never)).toHaveLength(1);
    expect(await repo.findByCustomer(row.customer_id as never)).toHaveLength(1);
  });

  it("create() maps the inserted row back to a domain Appointment", async () => {
    const repo = new AppointmentRepository(
      clientReturning({ data: row, error: null }),
    );
    const appointment = await repo.create({
      retailerId: row.retailer_id as never,
      customerId: row.customer_id as never,
      type: "styling_consultation",
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    });
    expect(appointment.type).toBe("styling_consultation");
  });

  it("update() maps the updated row back to a domain Appointment", async () => {
    const updatedRow: AppointmentRow = { ...row, status: "confirmed" };
    const repo = new AppointmentRepository(
      clientReturning({ data: updatedRow, error: null }),
    );
    const appointment = await repo.update(row.id as never, {
      status: "confirmed",
    });
    expect(appointment.status).toBe("confirmed");
  });

  it("requestAppointment calls the request_appointment RPC and returns the new id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: row.id, error: null });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new AppointmentRepository(client);

    const appointmentId = await repo.requestAppointment({
      retailerId: row.retailer_id as never,
      type: "styling_consultation",
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    });

    expect(rpc).toHaveBeenCalledWith("request_appointment", {
      p_retailer_id: row.retailer_id,
      p_type: "styling_consultation",
      p_starts_at: row.starts_at,
      p_ends_at: row.ends_at,
      p_notes: null,
    });
    expect(appointmentId).toBe(row.id);
  });

  it("requestAppointment rejects when the RPC errors", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("boom") });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new AppointmentRepository(client);

    await expect(
      repo.requestAppointment({
        retailerId: row.retailer_id as never,
        type: "styling_consultation",
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      }),
    ).rejects.toBeTruthy();
  });
});
