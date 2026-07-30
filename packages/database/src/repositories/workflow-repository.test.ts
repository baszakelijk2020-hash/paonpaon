import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { WorkflowRepository } from "./workflow-repository";

const retailerId = asId<"RetailerId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const appointmentId = asId<"AppointmentId">(
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
);

describe("WorkflowRepository", () => {
  it("calls transition RPC with staff and branch context", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: appointmentId,
        retailer_id: retailerId,
        customer_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        type: "fitting",
        status: "confirmed",
        starts_at: "2026-07-30T10:00:00.000Z",
        ends_at: "2026-07-30T11:00:00.000Z",
        created_at: "2026-07-30T09:00:00.000Z",
        updated_at: "2026-07-30T09:05:00.000Z",
        deleted_at: null,
        staff_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        branch_id: null,
        location_id: null,
        notes: null,
      },
      error: null,
    });

    const repo = new WorkflowRepository({
      rpc,
    } as unknown as PaonSupabaseClient);
    const staffId = asId<"StaffId">("dddddddd-dddd-4ddd-8ddd-dddddddddddd");

    await repo.transitionAppointment({
      appointmentId,
      toState: "confirmed",
      staffId,
    });

    expect(rpc).toHaveBeenCalledWith("transition_appointment_workflow", {
      p_appointment_id: appointmentId,
      p_to_state: "confirmed",
      p_staff_id: staffId,
      p_branch_id: null,
      p_reason: null,
    });
  });

  it("scopes instance lookup to retailer and subject", async () => {
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const repo = new WorkflowRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await repo.findInstanceBySubject({
      retailerId,
      subjectType: "appointment",
      subjectId: appointmentId,
    });

    expect(from).toHaveBeenCalledWith("workflow_instances");
    const builder = from.mock.results[0]?.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.eq).toHaveBeenCalledWith("retailer_id", retailerId);
    expect(builder.eq).toHaveBeenCalledWith("subject_type", "appointment");
    expect(builder.eq).toHaveBeenCalledWith("subject_id", appointmentId);
  });
});
