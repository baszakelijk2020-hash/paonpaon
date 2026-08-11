import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { AlterationTaskRepository } from "./alteration-task-repository";

describe("AlterationTaskRepository", () => {
  it("updates task status through the validated workflow RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const repository = new AlterationTaskRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await repository.updateStatus(
      "11111111-1111-1111-1111-111111111111" as never,
      "in_progress",
      "Work started.",
    );

    expect(rpc).toHaveBeenCalledWith("update_alteration_task_status", {
      p_task_id: "11111111-1111-1111-1111-111111111111",
      p_status: "in_progress",
      p_note: "Work started.",
    });
  });

  it("appends an independent work note through its narrow RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const repository = new AlterationTaskRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await repository.addNote(
      "11111111-1111-1111-1111-111111111111" as never,
      "Sleeve opened and basted.",
    );

    expect(rpc).toHaveBeenCalledWith("add_alteration_task_note", {
      p_task_id: "11111111-1111-1111-1111-111111111111",
      p_note: "Sleeve opened and basted.",
    });
  });

  it("records labour/material/partner cost allocation through the management-gated RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const repository = new AlterationTaskRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await repository.recordCostAllocation({
      taskId: "11111111-1111-1111-1111-111111111111" as never,
      labourCostAmountMinorUnits: 2000,
      materialCostAmountMinorUnits: 500,
      partnerCostAmountMinorUnits: 0,
      currency: "usd",
      reason: "Workshop invoice #4821",
    });

    expect(rpc).toHaveBeenCalledWith("record_alteration_task_cost_allocation", {
      p_task_id: "11111111-1111-1111-1111-111111111111",
      p_labour_cost_amount_minor_units: 2000,
      p_material_cost_amount_minor_units: 500,
      p_partner_cost_amount_minor_units: 0,
      p_currency: "usd",
      p_reason: "Workshop invoice #4821",
    });
  });
});
