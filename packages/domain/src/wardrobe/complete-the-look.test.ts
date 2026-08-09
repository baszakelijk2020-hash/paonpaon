import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  outfitSlotKindForGarmentCategory,
  resolveGarmentCategoryFromConcepts,
  selectCompleteTheLookSuggestions,
} from "./complete-the-look";

describe("selectCompleteTheLookSuggestions", () => {
  it("suggests a catalogue category the customer owns nothing in", () => {
    const result = selectCompleteTheLookSuggestions({
      wardrobe: [
        {
          wardrobeItemId: "item-1",
          displayName: "Navy jacket",
          categoryCode: "jacket",
          condition: "good",
          careState: "current",
        },
      ],
      catalogue: [
        {
          productId: "product-shoes",
          displayName: "Oxford shoes",
          productSlug: "oxford-shoes",
          categoryCode: "shoes",
          available: true,
        },
      ],
    });

    expect(result).toEqual([
      {
        categoryCode: "shoes",
        productId: "product-shoes",
        displayName: "Oxford shoes",
        productSlug: "oxford-shoes",
        explanation: "You don't have a pair of shoes yet.",
      },
    ]);
  });

  it("never suggests a category the customer already owns an active item in", () => {
    const result = selectCompleteTheLookSuggestions({
      wardrobe: [
        {
          wardrobeItemId: "item-1",
          displayName: "Black Oxfords",
          categoryCode: "shoes",
          condition: "good",
          careState: "current",
        },
      ],
      catalogue: [
        {
          productId: "product-shoes",
          displayName: "Oxford shoes",
          productSlug: "oxford-shoes",
          categoryCode: "shoes",
          available: true,
        },
      ],
    });
    expect(result).toEqual([]);
  });

  it("treats a retired or deleted owned item as not owned — the gap still surfaces", () => {
    const result = selectCompleteTheLookSuggestions({
      wardrobe: [
        {
          wardrobeItemId: "item-1",
          displayName: "Worn-out Oxfords",
          categoryCode: "shoes",
          condition: "fair",
          careState: "current",
          retiredAt: "2026-01-01T00:00:00.000Z",
        },
        {
          wardrobeItemId: "item-2",
          displayName: "Deleted jacket",
          categoryCode: "jacket",
          condition: "good",
          careState: "current",
          deletedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      catalogue: [
        {
          productId: "product-shoes",
          displayName: "Oxford shoes",
          productSlug: "oxford-shoes",
          categoryCode: "shoes",
          available: true,
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.categoryCode).toBe("shoes");
  });

  it("skips an unavailable catalogue product", () => {
    const result = selectCompleteTheLookSuggestions({
      wardrobe: [],
      catalogue: [
        {
          productId: "product-shoes",
          displayName: "Oxford shoes",
          productSlug: "oxford-shoes",
          categoryCode: "shoes",
          available: false,
        },
      ],
    });
    expect(result).toEqual([]);
  });

  it("skips a catalogue product with no category code — nothing to compare against ownership", () => {
    const result = selectCompleteTheLookSuggestions({
      wardrobe: [],
      catalogue: [
        {
          productId: "product-mystery",
          displayName: "Mystery item",
          productSlug: "mystery-item",
          available: true,
        },
      ],
    });
    expect(result).toEqual([]);
  });

  it("suggests at most one product per gap category, first available wins", () => {
    const result = selectCompleteTheLookSuggestions({
      wardrobe: [],
      catalogue: [
        {
          productId: "product-shoes-1",
          displayName: "Oxford shoes",
          productSlug: "oxford-shoes",
          categoryCode: "shoes",
          available: true,
        },
        {
          productId: "product-shoes-2",
          displayName: "Derby shoes",
          productSlug: "derby-shoes",
          categoryCode: "shoes",
          available: true,
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.productId).toBe("product-shoes-1");
  });

  it("caps suggestions at maxSuggestions", () => {
    const result = selectCompleteTheLookSuggestions({
      wardrobe: [],
      catalogue: [
        {
          productId: "product-shoes",
          displayName: "Oxford shoes",
          productSlug: "oxford-shoes",
          categoryCode: "shoes",
          available: true,
        },
        {
          productId: "product-shirt",
          displayName: "White shirt",
          productSlug: "white-shirt",
          categoryCode: "shirt",
          available: true,
        },
        {
          productId: "product-trousers",
          displayName: "Grey trousers",
          productSlug: "grey-trousers",
          categoryCode: "trousers",
          available: true,
        },
      ],
      maxSuggestions: 2,
    });
    expect(result).toHaveLength(2);
  });

  it("carries productVariantId and primaryImageUrl through when present", () => {
    const result = selectCompleteTheLookSuggestions({
      wardrobe: [],
      catalogue: [
        {
          productId: "product-shoes",
          productVariantId: "variant-9",
          displayName: "Oxford shoes",
          productSlug: "oxford-shoes",
          categoryCode: "shoes",
          available: true,
          primaryImageUrl: "https://example.test/shoes.jpg",
        },
      ],
    });
    expect(result).toEqual([
      {
        categoryCode: "shoes",
        productId: "product-shoes",
        productVariantId: "variant-9",
        displayName: "Oxford shoes",
        productSlug: "oxford-shoes",
        primaryImageUrl: "https://example.test/shoes.jpg",
        explanation: "You don't have a pair of shoes yet.",
      },
    ]);
  });
});

describe("resolveGarmentCategoryFromConcepts", () => {
  it("matches a garment_type concept by slug/label keyword", () => {
    const conceptId = asId<"MetadataConceptId">("concept-1");
    const result = resolveGarmentCategoryFromConcepts({
      concepts: [
        {
          id: conceptId,
          kind: "garment_type",
          slug: "oxford-shoe",
          label: "Oxford Shoe",
        },
      ],
    });
    expect(result.get(conceptId)).toBe("shoes");
  });

  it("prefers the more specific keyword over a substring it contains", () => {
    const conceptId = asId<"MetadataConceptId">("concept-overcoat");
    const result = resolveGarmentCategoryFromConcepts({
      concepts: [
        {
          id: conceptId,
          kind: "garment_type",
          slug: "overcoat",
          label: "Overcoat",
        },
      ],
    });
    expect(result.get(conceptId)).toBe("overcoat");
  });

  it("ignores a concept of a different kind", () => {
    const result = resolveGarmentCategoryFromConcepts({
      concepts: [
        {
          id: asId<"MetadataConceptId">("concept-1"),
          kind: "fabric",
          slug: "wool",
          label: "Wool",
        },
      ],
    });
    expect(result.size).toBe(0);
  });

  it("leaves an unresolvable garment_type concept unmapped", () => {
    const result = resolveGarmentCategoryFromConcepts({
      concepts: [
        {
          id: asId<"MetadataConceptId">("concept-1"),
          kind: "garment_type",
          slug: "mystery",
          label: "Mystery",
        },
      ],
    });
    expect(result.size).toBe(0);
  });
});

describe("outfitSlotKindForGarmentCategory", () => {
  it("maps every GarmentCategoryCode to a valid OutfitSlotKind", () => {
    expect(outfitSlotKindForGarmentCategory("suit")).toBe("jacket");
    expect(outfitSlotKindForGarmentCategory("trousers")).toBe("trousers");
    expect(outfitSlotKindForGarmentCategory("shoes")).toBe("shoes");
    expect(outfitSlotKindForGarmentCategory("pocket_square")).toBe(
      "pocket_square",
    );
    expect(outfitSlotKindForGarmentCategory("accessories")).toBe("accessories");
    expect(outfitSlotKindForGarmentCategory("other")).toBe("accessories");
  });
});
