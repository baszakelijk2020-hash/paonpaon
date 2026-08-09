import { describe, expect, it } from "vitest";

import { isSavedLook } from "./outfit";

describe("isSavedLook", () => {
  it("is true for an ordinary customer-composed outfit", () => {
    expect(isSavedLook({})).toBe(true);
  });

  it("is false for a roadmap-linked outfit", () => {
    expect(isSavedLook({ roadmapId: "roadmap-1" })).toBe(false);
  });

  it("is false for a Complete the Look throwaway generation outfit", () => {
    expect(isSavedLook({ isSuggestionGeneration: true })).toBe(false);
  });

  it("is false when both are set", () => {
    expect(
      isSavedLook({ roadmapId: "roadmap-1", isSuggestionGeneration: true }),
    ).toBe(false);
  });
});
