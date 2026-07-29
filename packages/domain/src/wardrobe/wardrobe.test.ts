import { describe, expect, it } from "vitest";

import {
  externalWardrobeItemMayLinkCatalogue,
  wardrobeConditionLabel,
  wardrobeOwnershipLabel,
} from "./wardrobe";
import {
  createExternalWardrobeItemInputSchema,
  updateWardrobeItemStateInputSchema,
} from "./wardrobe.schema";

describe("wardrobe domain", () => {
  it("labels ownership sources for customer display", () => {
    expect(wardrobeOwnershipLabel("retailer_purchase")).toBe("Purchased here");
    expect(wardrobeOwnershipLabel("external")).toBe("Added by you");
  });

  it("labels condition states", () => {
    expect(wardrobeConditionLabel("needs_repair")).toBe("Needs repair");
  });

  it("rejects external items that would link catalogue aggregates", () => {
    expect(
      externalWardrobeItemMayLinkCatalogue({
        categoryCode: "jacket",
        title: "Navy blazer",
      }),
    ).toBe(true);
    expect(
      externalWardrobeItemMayLinkCatalogue({
        categoryCode: "jacket",
        title: "Navy blazer",
        productId: "00000000-0000-4000-8000-000000000001" as never,
      }),
    ).toBe(false);
  });

  it("validates external wardrobe item input", () => {
    const parsed = createExternalWardrobeItemInputSchema.safeParse({
      categoryCode: "shirt",
      title: "White poplin shirt",
      conditionState: "good",
      wearFrequency: "sometimes",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty external titles", () => {
    const parsed = createExternalWardrobeItemInputSchema.safeParse({
      categoryCode: "shirt",
      title: "   ",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts partial wardrobe state updates", () => {
    const parsed = updateWardrobeItemStateInputSchema.safeParse({
      fitNotes: "Slightly tight across shoulders",
    });
    expect(parsed.success).toBe(true);
  });
});
