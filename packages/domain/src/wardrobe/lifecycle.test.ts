import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import { deriveWardrobeGuidance } from "./lifecycle";
import type { WardrobeItem } from "./wardrobe";

const baseItem: Pick<
  WardrobeItem,
  | "id"
  | "displayName"
  | "condition"
  | "wearFrequency"
  | "careState"
  | "acquiredAt"
  | "createdAt"
> = {
  id: asId<"WardrobeItemId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
  displayName: "Navy jacket",
  condition: "good",
  wearFrequency: "regularly",
  careState: "due_soon",
  acquiredAt: "2020-01-01T00:00:00.000Z",
  createdAt: "2020-01-01T00:00:00.000Z",
};

describe("deriveWardrobeGuidance", () => {
  const now = "2026-07-30T12:00:00.000Z";

  it("produces respectful care guidance without replacement pressure", () => {
    const guidance = deriveWardrobeGuidance({
      item: baseItem,
      lifecycleEvents: [],
      dismissedKeys: new Set(),
      now,
    });
    expect(guidance.some((item) => item.kind === "care_due")).toBe(true);
    expect(
      guidance.every((item) => !item.explanation.includes("must replace")),
    ).toBe(true);
  });

  it("respects dismissed guidance keys", () => {
    const key = `${baseItem.id}:care_due`;
    const guidance = deriveWardrobeGuidance({
      item: baseItem,
      lifecycleEvents: [],
      dismissedKeys: new Set([key]),
      now,
    });
    expect(guidance.some((item) => item.key === key)).toBe(false);
  });

  it("celebrates longevity for older well-kept pieces", () => {
    const guidance = deriveWardrobeGuidance({
      item: baseItem,
      lifecycleEvents: [],
      dismissedKeys: new Set(),
      now,
    });
    expect(guidance.some((item) => item.kind === "longevity_celebration")).toBe(
      true,
    );
  });
});
