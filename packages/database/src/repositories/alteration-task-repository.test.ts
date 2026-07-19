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
});
