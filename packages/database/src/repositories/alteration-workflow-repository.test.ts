import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { AlterationWorkflowRepository } from "./alteration-workflow-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

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

  it("finds retailer-wide pending proposals for the dashboard digest, carrying the work order number", async () => {
    const from = vi.fn().mockReturnValue(
      fakeQueryBuilder({
        data: [
          {
            id: "44444444-4444-4444-4444-444444444444",
            alteration_id: "11111111-1111-1111-1111-111111111111",
            task_id: null,
            retailer_id: "22222222-2222-2222-2222-222222222222",
            original_amount_minor_units: 12000,
            proposed_amount_minor_units: 14500,
            currency: "GBP",
            explanation: "Additional hand finishing.",
            evidence_attachment_id: null,
            status: "pending",
            proposed_by_staff_id: "33333333-3333-3333-3333-333333333333",
            decided_by_staff_id: null,
            decided_at: null,
            decision_reason: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            deleted_at: null,
            alteration_work_orders: { work_order_number: "ALT-000001" },
          },
        ],
        error: null,
      }),
    );
    const repository = new AlterationWorkflowRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const result = await repository.findPendingProposalsByRetailer(
      "22222222-2222-2222-2222-222222222222" as never,
    );

    expect(from).toHaveBeenCalledWith("price_change_proposals");
    expect(result).toEqual([
      expect.objectContaining({
        id: "44444444-4444-4444-4444-444444444444",
        status: "pending",
        workOrderNumber: "ALT-000001",
      }),
    ]);
  });

  it("maps completion-review employee attribution", async () => {
    const from = vi.fn().mockReturnValue(
      fakeQueryBuilder({
        data: [
          {
            id: "55555555-5555-5555-5555-555555555555",
            alteration_id: "11111111-1111-1111-1111-111111111111",
            retailer_id: "22222222-2222-2222-2222-222222222222",
            status: "approved",
            notes: "Finishing and symmetry confirmed.",
            reviewed_by_staff_id: "33333333-3333-3333-3333-333333333333",
            reviewed_at: "2026-07-24T10:00:00.000Z",
            created_at: "2026-07-24T09:00:00.000Z",
            updated_at: "2026-07-24T10:00:00.000Z",
            deleted_at: null,
          },
        ],
        error: null,
      }),
    );

    const result = await new AlterationWorkflowRepository({
      from,
    } as unknown as PaonSupabaseClient).findCompletionReviews(
      "11111111-1111-1111-1111-111111111111" as never,
    );

    expect(result).toEqual([
      expect.objectContaining({
        status: "approved",
        reviewedByStaffId: "33333333-3333-3333-3333-333333333333",
        notes: "Finishing and symmetry confirmed.",
      }),
    ]);
  });
});
