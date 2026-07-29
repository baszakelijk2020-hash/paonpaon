import { describe, expect, it } from "vitest";

import { wardrobeItemCountByCustomer } from "./wardrobe-repository";

describe("WardrobeRepository helpers", () => {
  it("counts only active wardrobe items", () => {
    const items = [
      {
        id: "a" as never,
        retailerId: "r" as never,
        customerId: "c" as never,
        ownershipSource: "external" as const,
        categoryCode: "jacket" as const,
        title: "Jacket",
        state: { conditionState: "good" as const },
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "b" as never,
        retailerId: "r" as never,
        customerId: "c" as never,
        ownershipSource: "external" as const,
        categoryCode: "shirt" as const,
        title: "Shirt",
        state: { conditionState: "good" as const },
        archivedAt: "2026-02-01T00:00:00Z",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    expect(wardrobeItemCountByCustomer(items)).toBe(1);
  });
});
