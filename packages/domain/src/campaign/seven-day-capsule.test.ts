import { describe, expect, it } from "vitest";

import {
  buildSevenDayCapsule,
  isOwnedFirstCapsule,
} from "./seven-day-capsule";

describe("buildSevenDayCapsule", () => {
  it("prefers owned wardrobe pieces before catalogue suggestions", () => {
    const days = buildSevenDayCapsule({
      wardrobeItems: [
        {
          wardrobeItemId: "w-jacket",
          displayName: "Navy hopsack jacket",
          categoryCode: "jacket",
        },
        {
          wardrobeItemId: "w-trousers",
          displayName: "Grey flannel trousers",
          categoryCode: "trousers",
        },
        {
          wardrobeItemId: "w-shirt",
          displayName: "White poplin shirt",
          categoryCode: "shirt",
        },
        {
          wardrobeItemId: "w-shoes",
          displayName: "Oxford brogues",
          categoryCode: "shoes",
        },
      ],
      catalogueCandidates: [
        {
          productId: "p-jacket",
          displayName: "Catalogue jacket",
          slotKind: "jacket",
          inventoryQuantity: 5,
        },
      ],
    });

    expect(days).toHaveLength(7);
    expect(days[0]?.slots.every((slot) => slot.sourceKind === "owned")).toBe(
      true,
    );
    expect(days[0]?.gaps).toHaveLength(0);
    expect(isOwnedFirstCapsule({ days })).toBe(true);
  });

  it("cites gaps when catalogue fills missing owned slots", () => {
    const days = buildSevenDayCapsule({
      wardrobeItems: [
        {
          wardrobeItemId: "w-jacket",
          displayName: "Navy jacket",
          categoryCode: "jacket",
        },
      ],
      catalogueCandidates: [
        {
          productId: "p-trousers",
          displayName: "Charcoal trousers",
          slotKind: "trousers",
          inventoryQuantity: 2,
          leadTimeDays: 5,
        },
        {
          productId: "p-shirt",
          displayName: "Blue shirt",
          slotKind: "shirt",
          inventoryQuantity: 1,
        },
        {
          productId: "p-shoes",
          displayName: "Loafers",
          slotKind: "shoes",
          inventoryQuantity: 3,
        },
      ],
    });

    const dayOne = days[0];
    expect(dayOne?.slots.find((slot) => slot.slotKind === "jacket")?.sourceKind).toBe(
      "owned",
    );
    expect(
      dayOne?.slots.find((slot) => slot.slotKind === "trousers")?.sourceKind,
    ).toBe("catalogue_suggested");
    expect(dayOne?.gaps.length).toBeGreaterThan(0);
    expect(dayOne?.gaps[0]?.factCitation).toContain("Charcoal trousers");
  });

  it("skips retired wardrobe items", () => {
    const days = buildSevenDayCapsule({
      wardrobeItems: [
        {
          wardrobeItemId: "w-retired",
          displayName: "Retired jacket",
          categoryCode: "jacket",
          retiredAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      catalogueCandidates: [
        {
          productId: "p-jacket",
          displayName: "Replacement jacket",
          slotKind: "jacket",
          inventoryQuantity: 1,
        },
        {
          productId: "p-trousers",
          displayName: "Trousers",
          slotKind: "trousers",
          inventoryQuantity: 1,
        },
        {
          productId: "p-shirt",
          displayName: "Shirt",
          slotKind: "shirt",
          inventoryQuantity: 1,
        },
        {
          productId: "p-shoes",
          displayName: "Shoes",
          slotKind: "shoes",
          inventoryQuantity: 1,
        },
      ],
    });

    expect(
      days[0]?.slots.find((slot) => slot.slotKind === "jacket")?.sourceKind,
    ).toBe("catalogue_suggested");
  });
});
