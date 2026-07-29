import {
  asId,
  canTransitionRoadmapStatus,
  type WardrobeRoadmap,
} from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import { WardrobeRoadmapRepository } from "./wardrobe-roadmap-repository";

function roadmapRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    retailer_id: "00000000-0000-4000-8000-000000000011",
    customer_id: "00000000-0000-4000-8000-000000000012",
    title: "Plan",
    summary: null,
    horizon_label: null,
    status: "draft",
    created_by_staff_id: "00000000-0000-4000-8000-000000000013",
    approved_at: null,
    approved_by_staff_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("WardrobeRoadmapRepository", () => {
  it("creates a draft roadmap for advisor authoring", async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: roadmapRow(),
          error: null,
        }),
      }),
    });
    const client = {
      from: vi.fn().mockReturnValue({ insert }),
    };

    const repo = new WardrobeRoadmapRepository(client as never);
    const roadmap = await repo.createRoadmap(
      {
        retailerId: "00000000-0000-4000-8000-000000000011",
        customerId: "00000000-0000-4000-8000-000000000012",
        title: "Three-year plan",
      },
      asId<"StaffId">("00000000-0000-4000-8000-000000000013"),
    );

    expect(roadmap.status).toBe("draft");
    expect(roadmap.title).toBe("Plan");
    expect(insert).toHaveBeenCalled();
  });

  it("rejects invalid roadmap status transitions", async () => {
    const roadmap: WardrobeRoadmap = {
      id: asId<"WardrobeRoadmapId">("00000000-0000-4000-8000-000000000010"),
      retailerId: asId<"RetailerId">("00000000-0000-4000-8000-000000000011"),
      customerId: asId<"CustomerId">("00000000-0000-4000-8000-000000000012"),
      title: "Plan",
      status: "approved",
      createdByStaffId: asId<"StaffId">("00000000-0000-4000-8000-000000000013"),
      goals: [],
      gaps: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(canTransitionRoadmapStatus(roadmap.status, "draft")).toBe(false);
  });
});
