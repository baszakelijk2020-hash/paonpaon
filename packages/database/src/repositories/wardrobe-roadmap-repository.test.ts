import { asId, type WardrobeRoadmap } from "@paon/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";
import { WardrobeRoadmapRepository } from "./wardrobe-roadmap-repository";

const retailerId = "00000000-0000-4000-8000-000000000001";
const customerId = "00000000-0000-4000-8000-000000000011";
const staffId = "00000000-0000-4000-8000-000000000031";
const roadmapId = "00000000-0000-4000-8000-000000000201";
const goalId = "00000000-0000-4000-8000-000000000211";
const gapId = "00000000-0000-4000-8000-000000000221";
const stageId = "00000000-0000-4000-8000-000000000231";
const ruleId = "00000000-0000-4000-8000-00000000a001";
const productId = "00000000-0000-4000-8000-000000000241";

function roadmapRow(status = "draft") {
  return {
    id: roadmapId,
    retailer_id: retailerId,
    customer_id: customerId,
    title: "Travel wardrobe",
    summary: "Build a travel core",
    horizon_label: "3 years",
    status,
    authored_by_staff_id: staffId,
    submitted_at: null,
    decided_at: null,
    decided_by_actor: null,
    customer_decision_note: null,
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z",
    deleted_at: null,
  };
}

function goalRow() {
  return {
    id: goalId,
    roadmap_id: roadmapId,
    retailer_id: retailerId,
    title: "Travel core",
    description: null,
    display_order: 0,
    created_at: "2026-07-30T00:00:00.000Z",
  };
}

function gapRow() {
  return {
    id: gapId,
    roadmap_id: roadmapId,
    retailer_id: retailerId,
    title: "Missing navy jacket",
    description: null,
    rank: 1,
    slot_kind: "jacket",
    category_code: "jacket",
    filled_by_product_id: null,
    filled_by_wardrobe_item_id: null,
    how_purchase_fills_gap: "Anchors weekday looks.",
    created_at: "2026-07-30T00:00:00.000Z",
  };
}

function stageRow() {
  return {
    id: stageId,
    roadmap_id: roadmapId,
    retailer_id: retailerId,
    title: "Stage 1",
    description: null,
    stage_order: 1,
    gap_id: gapId,
    suggested_product_id: productId,
    suggested_wardrobe_item_id: null,
    explanation: "Buy the jacket first.",
    rule_citations: [
      {
        ruleId,
        ruleTitle: "Jacket foundation",
        relation: "requires",
        explanation: "Jacket supports trousers pairing.",
      },
    ],
    fact_citations: [
      {
        sourceKind: "catalogue_product",
        sourceId: productId,
        label: "Navy jacket",
        detail: "Suggested catalogue jacket",
      },
    ],
    created_at: "2026-07-30T00:00:00.000Z",
  };
}

describe("WardrobeRoadmapRepository", () => {
  const from = vi.fn();
  const client = { from } as never;
  let repo: WardrobeRoadmapRepository;

  beforeEach(() => {
    from.mockReset();
    repo = new WardrobeRoadmapRepository(client);
  });

  it("creates a draft roadmap with goals, ranked gaps, and cited stages", async () => {
    from
      .mockReturnValueOnce(
        fakeQueryBuilder({ data: roadmapRow(), error: null }),
      )
      .mockReturnValueOnce(fakeQueryBuilder({ data: [goalRow()], error: null }))
      .mockReturnValueOnce(fakeQueryBuilder({ data: [gapRow()], error: null }))
      .mockReturnValueOnce(
        fakeQueryBuilder({ data: [stageRow()], error: null }),
      );

    const created = await repo.createDraft(
      {
        retailerId,
        customerId,
        title: "Travel wardrobe",
        summary: "Build a travel core",
        horizonLabel: "3 years",
        goals: [{ title: "Travel core", displayOrder: 0 }],
        gaps: [
          {
            title: "Missing navy jacket",
            rank: 1,
            slotKind: "jacket",
            categoryCode: "jacket",
            howPurchaseFillsGap: "Anchors weekday looks.",
          },
        ],
        stages: [
          {
            title: "Stage 1",
            stageOrder: 1,
            gapIndex: 0,
            suggestedProductId: productId,
            explanation: "Buy the jacket first.",
            ruleCitations: [
              {
                ruleId,
                ruleTitle: "Jacket foundation",
                relation: "requires",
                explanation: "Jacket supports trousers pairing.",
              },
            ],
            factCitations: [
              {
                sourceKind: "catalogue_product",
                sourceId: productId,
                label: "Navy jacket",
                detail: "Suggested catalogue jacket",
              },
            ],
          },
        ],
      },
      asId<"StaffId">(staffId),
    );

    expect(created.status).toBe("draft");
    expect(created.gaps[0]?.rank).toBe(1);
    expect(created.stages[0]?.ruleCitations[0]?.ruleId).toBe(ruleId);
    expect(created.stages[0]?.factCitations[0]?.sourceKind).toBe(
      "catalogue_product",
    );
  });

  it("transitions a pending roadmap to approved for the customer", async () => {
    from
      .mockReturnValueOnce(
        fakeQueryBuilder({
          data: roadmapRow("pending_approval"),
          error: null,
        }),
      )
      .mockReturnValueOnce(fakeQueryBuilder({ data: [goalRow()], error: null }))
      .mockReturnValueOnce(fakeQueryBuilder({ data: [gapRow()], error: null }))
      .mockReturnValueOnce(
        fakeQueryBuilder({ data: [stageRow()], error: null }),
      )
      .mockReturnValueOnce(
        fakeQueryBuilder({
          data: {
            ...roadmapRow("approved"),
            decided_at: "2026-07-30T01:00:00.000Z",
            decided_by_actor: "customer",
            customer_decision_note: "Looks right.",
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(fakeQueryBuilder({ data: [goalRow()], error: null }))
      .mockReturnValueOnce(fakeQueryBuilder({ data: [gapRow()], error: null }))
      .mockReturnValueOnce(
        fakeQueryBuilder({ data: [stageRow()], error: null }),
      );

    const approved: WardrobeRoadmap = await repo.transition(
      {
        roadmapId,
        action: "approve",
        note: "Looks right.",
      },
      {
        kind: "customer",
        customerId: asId<"CustomerId">(customerId),
        retailerId: asId<"RetailerId">(retailerId),
      },
    );

    expect(approved.status).toBe("approved");
    expect(approved.decidedByActor).toBe("customer");
  });
});
