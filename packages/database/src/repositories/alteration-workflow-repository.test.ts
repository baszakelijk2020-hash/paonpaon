import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { AlterationWorkflowRepository } from "./alteration-workflow-repository";

describe("AlterationWorkflowRepository", () => {
  it("assigns approved work through the transactional assignment RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const repository = new AlterationWorkflowRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await repository.assign({
      alterationId: "11111111-1111-1111-1111-111111111111" as never,
      workshopId: "22222222-2222-2222-2222-222222222222" as never,
      targetCompletionDate: "2026-08-01",
    });

    expect(rpc).toHaveBeenCalledWith("assign_alteration_work_order", {
      p_alteration_id: "11111111-1111-1111-1111-111111111111",
      p_workshop_id: "22222222-2222-2222-2222-222222222222",
      p_target_completion_date: "2026-08-01",
    });
  });

  it("keeps workshop proposals separate from retailer decisions", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: "44444444-4444-4444-4444-444444444444",
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });
    const repository = new AlterationWorkflowRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    const proposalId = await repository.proposePriceChange({
      alterationId: "11111111-1111-1111-1111-111111111111" as never,
      proposedAmountMinorUnits: 14500,
      explanation: "Additional hand finishing was approved for review.",
    });
    await repository.decidePriceChange({
      proposalId,
      decision: "approved",
      reason: "Evidence and revised scope confirmed.",
    });

    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "propose_alteration_price_change",
      expect.objectContaining({
        p_proposed_amount_minor_units: 14500,
        p_task_id: null,
      }),
    );
    expect(rpc).toHaveBeenNthCalledWith(2, "decide_alteration_price_change", {
      p_proposal_id: "44444444-4444-4444-4444-444444444444",
      p_decision: "approved",
      p_reason: "Evidence and revised scope confirmed.",
    });
  });
});
