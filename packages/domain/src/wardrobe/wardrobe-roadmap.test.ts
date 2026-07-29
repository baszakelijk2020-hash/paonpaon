import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  canTransitionOutfitStatus,
  garmentCategoryToOutfitSlot,
  isOutfitSlotReferenceValid,
  outfitSlotReferenceIssues,
} from "./outfit";
import {
  canCustomerViewRoadmap,
  canTransitionRoadmapStatus,
  projectAdvisorBriefWardrobeGaps,
  type WardrobeRoadmap,
} from "./wardrobe-roadmap";

describe("outfit slots", () => {
  it("validates slot references", () => {
    expect(
      isOutfitSlotReferenceValid({
        slotKind: "jacket",
        displayLabel: "Navy hopsack",
        wardrobeItemId: asId<"WardrobeItemId">(
          "00000000-0000-4000-8000-000000000001",
        ),
      }),
    ).toBe(true);
    expect(
      outfitSlotReferenceIssues({
        slotKind: "shirt",
        displayLabel: "",
        productId: null,
        wardrobeItemId: null,
      }),
    ).toContain("slot_requires_reference_or_label");
  });

  it("maps garment categories to outfit slots", () => {
    expect(garmentCategoryToOutfitSlot("jacket")).toBe("jacket");
    expect(garmentCategoryToOutfitSlot("trousers")).toBe("trousers");
    expect(garmentCategoryToOutfitSlot("other")).toBeNull();
  });

  it("enforces outfit status transitions", () => {
    expect(canTransitionOutfitStatus("draft", "proposed")).toBe(true);
    expect(canTransitionOutfitStatus("proposed", "approved")).toBe(true);
    expect(canTransitionOutfitStatus("approved", "draft")).toBe(false);
  });
});

describe("wardrobe roadmap", () => {
  const baseRoadmap: WardrobeRoadmap = {
    id: asId<"WardrobeRoadmapId">("00000000-0000-4000-8000-000000000010"),
    retailerId: asId<"RetailerId">("00000000-0000-4000-8000-000000000011"),
    customerId: asId<"CustomerId">("00000000-0000-4000-8000-000000000012"),
    title: "Three-year plan",
    status: "approved",
    createdByStaffId: asId<"StaffId">("00000000-0000-4000-8000-000000000013"),
    goals: [],
    gaps: [
      {
        id: asId<"WardrobeGapId">("00000000-0000-4000-8000-000000000020"),
        roadmapId: asId<"WardrobeRoadmapId">(
          "00000000-0000-4000-8000-000000000010",
        ),
        retailerId: asId<"RetailerId">("00000000-0000-4000-8000-000000000011"),
        customerId: asId<"CustomerId">("00000000-0000-4000-8000-000000000012"),
        title: "Summer trousers",
        slotKind: "trousers",
        rank: 2,
        stagePriority: 1,
        status: "open",
        knowledgeObjectId: asId<"KnowledgeObjectId">(
          "00000000-0000-4000-8000-000000000030",
        ),
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: asId<"WardrobeGapId">("00000000-0000-4000-8000-000000000021"),
        roadmapId: asId<"WardrobeRoadmapId">(
          "00000000-0000-4000-8000-000000000010",
        ),
        retailerId: asId<"RetailerId">("00000000-0000-4000-8000-000000000011"),
        customerId: asId<"CustomerId">("00000000-0000-4000-8000-000000000012"),
        title: "Casual jacket",
        slotKind: "jacket",
        rank: 1,
        stagePriority: 2,
        status: "open",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("allows advisor proposal and customer approval transitions", () => {
    expect(canTransitionRoadmapStatus("draft", "proposed")).toBe(true);
    expect(canTransitionRoadmapStatus("proposed", "approved")).toBe(true);
    expect(canTransitionRoadmapStatus("approved", "draft")).toBe(false);
  });

  it("shows approved plan to customer only when approved", () => {
    expect(canCustomerViewRoadmap({ ...baseRoadmap, status: "proposed" })).toBe(
      false,
    );
    expect(canCustomerViewRoadmap(baseRoadmap)).toBe(true);
  });

  it("projects ranked open gaps for advisor brief", () => {
    const gaps = projectAdvisorBriefWardrobeGaps(baseRoadmap, {
      ruleTitles: new Map([
        [
          "00000000-0000-4000-8000-000000000030",
          "Styling compatibility basics",
        ],
      ]),
      productLabels: new Map(),
    });
    expect(gaps.map((g) => g.title)).toEqual([
      "Casual jacket",
      "Summer trousers",
    ]);
    expect(gaps[1]?.ruleTitle).toBe("Styling compatibility basics");
  });
});
