import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";
import { money } from "../shared/money";

import {
  buildTieMateActionPaths,
  buildTieMateDeck,
  resolveTieConceptIds,
  resolveTieMateFabricImage,
  resolveTieMateKeyboardAction,
  TIE_MATE_FABRIC_PHOTO_GUIDANCE,
  type TieMateFabricCandidate,
} from "./tie-mate";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const tieConcept = asId<"MetadataConceptId">(
  "22222222-2222-4222-8222-222222222201",
);
const jacketConcept = asId<"MetadataConceptId">(
  "22222222-2222-4222-8222-222222222202",
);
const productA = asId<"ProductId">("33333333-3333-4333-8333-333333333301");
const productB = asId<"ProductId">("33333333-3333-4333-8333-333333333302");
const productC = asId<"ProductId">("33333333-3333-4333-8333-333333333303");
const variantA = asId<"ProductVariantId">(
  "44444444-4444-4444-8444-444444444401",
);
const variantB = asId<"ProductVariantId">(
  "44444444-4444-4444-8444-444444444402",
);
const variantC = asId<"ProductVariantId">(
  "44444444-4444-4444-8444-444444444403",
);

function candidate(
  overrides: Partial<TieMateFabricCandidate> &
    Pick<TieMateFabricCandidate, "productId" | "variantId" | "name">,
): TieMateFabricCandidate {
  return {
    productSlug: "silk-tie",
    status: "active",
    inventoryQuantity: 3,
    price: money(9500, "EUR"),
    acceptedConceptIds: [tieConcept],
    swatchImageUrl: "https://cdn.example/swatch-a.jpg",
    ...overrides,
  };
}

describe("resolveTieMateFabricImage", () => {
  it("prefers swatch close-up over primary", () => {
    expect(
      resolveTieMateFabricImage({
        swatchImageUrl: "https://cdn.example/swatch.jpg",
        primaryImageUrl: "https://cdn.example/hero.jpg",
      }),
    ).toEqual({
      url: "https://cdn.example/swatch.jpg",
      role: "swatch_closeup",
    });
  });

  it("falls back to primary when swatch is missing", () => {
    expect(
      resolveTieMateFabricImage({
        primaryImageUrl: "https://cdn.example/hero.jpg",
      }),
    ).toEqual({
      url: "https://cdn.example/hero.jpg",
      role: "primary_fallback",
    });
  });

  it("returns undefined when no image exists", () => {
    expect(resolveTieMateFabricImage({})).toBeUndefined();
  });
});

describe("resolveTieConceptIds", () => {
  it("selects accepted garment_type neckwear concepts", () => {
    const ids = resolveTieConceptIds({
      concepts: [
        {
          id: tieConcept,
          kind: "garment_type",
          slug: "silk-tie",
          label: "Silk Tie",
          reviewState: "accepted",
        },
        {
          id: jacketConcept,
          kind: "garment_type",
          slug: "jacket",
          label: "Jacket",
          reviewState: "accepted",
        },
        {
          id: asId<"MetadataConceptId">("22222222-2222-4222-8222-222222222203"),
          kind: "garment_type",
          slug: "bow-tie",
          label: "Bow Tie",
          reviewState: "proposed",
        },
      ],
    });
    expect([...ids]).toEqual([tieConcept]);
  });
});

describe("buildTieMateDeck", () => {
  it("builds stock-truthful cards preferring swatch photos", () => {
    const deck = buildTieMateDeck(
      [
        candidate({
          productId: productA,
          variantId: variantA,
          name: "Navy grenadine",
          swatchImageUrl: "https://cdn.example/navy-swatch.jpg",
          primaryImageUrl: "https://cdn.example/navy-hero.jpg",
        }),
        candidate({
          productId: productB,
          variantId: variantB,
          name: "Archive jacket",
          acceptedConceptIds: [jacketConcept],
          swatchImageUrl: "https://cdn.example/jacket.jpg",
        }),
        candidate({
          productId: productC,
          variantId: variantC,
          name: "Sold-out repp",
          inventoryQuantity: 0,
          swatchImageUrl: "https://cdn.example/repp.jpg",
        }),
      ],
      {
        retailerId,
        slug: "maison-demo",
        tieConceptIds: new Set([tieConcept]),
      },
    );

    expect(deck.cards).toHaveLength(1);
    expect(deck.cards[0]).toMatchObject({
      productId: productA,
      fabricImageUrl: "https://cdn.example/navy-swatch.jpg",
      fabricPhotoRole: "swatch_closeup",
      inStock: true,
    });
    expect(deck.skippedNotTie).toBe(1);
    expect(deck.skippedOutOfStock).toBe(1);
  });

  it("returns an empty deck with out-of-stock skip counts when no sellable ties remain", () => {
    const deck = buildTieMateDeck(
      [
        candidate({
          productId: productA,
          variantId: variantA,
          name: "Sold-out grenadine",
          inventoryQuantity: 0,
          swatchImageUrl: "https://cdn.example/oos-swatch.jpg",
        }),
        candidate({
          productId: productB,
          variantId: variantB,
          name: "Jacket only",
          acceptedConceptIds: [jacketConcept],
          swatchImageUrl: "https://cdn.example/jacket.jpg",
        }),
      ],
      {
        retailerId,
        slug: "maison-demo",
        tieConceptIds: new Set([tieConcept]),
      },
    );

    // Empty projection drives the Customer empty-guidance UI (no Save/Buy
    // controls until a stocked neckwear swatch is available).
    expect(deck.cards).toEqual([]);
    expect(deck.skippedOutOfStock).toBe(1);
    expect(deck.skippedNotTie).toBe(1);
    expect(deck.skippedWithoutPhoto).toBe(0);
  });

  it("skips ties without fabric photos and inactive products", () => {
    const noPhoto: TieMateFabricCandidate = {
      productId: productA,
      variantId: variantA,
      name: "No photo",
      productSlug: "no-photo",
      status: "active",
      inventoryQuantity: 3,
      price: money(9500, "EUR"),
      acceptedConceptIds: [tieConcept],
    };
    const deck = buildTieMateDeck(
      [
        noPhoto,
        candidate({
          productId: productB,
          variantId: variantB,
          name: "Draft",
          status: "draft",
        }),
        {
          productId: productC,
          variantId: variantC,
          name: "MTO without inventory",
          productSlug: "mto-tie",
          status: "active",
          inventoryQuantity: 0,
          isMadeToOrder: true,
          price: money(9500, "EUR"),
          acceptedConceptIds: [tieConcept],
          primaryImageUrl: "https://cdn.example/mto.jpg",
        },
      ],
      {
        retailerId,
        slug: "maison-demo",
        tieConceptIds: new Set([tieConcept]),
      },
    );

    expect(deck.cards).toHaveLength(1);
    expect(deck.cards[0]?.productId).toBe(productC);
    expect(deck.cards[0]?.fabricPhotoRole).toBe("primary_fallback");
    expect(deck.skippedWithoutPhoto).toBe(1);
    expect(deck.skippedInactive).toBe(1);
  });

  it("pins shortlisted products first and respects maxCards", () => {
    const deck = buildTieMateDeck(
      [
        candidate({
          productId: productA,
          variantId: variantA,
          name: "A",
          productSlug: "a",
        }),
        candidate({
          productId: productB,
          variantId: variantB,
          name: "B",
          productSlug: "b",
        }),
        candidate({
          productId: productC,
          variantId: variantC,
          name: "C",
          productSlug: "c",
        }),
      ],
      {
        retailerId,
        slug: "maison-demo",
        tieConceptIds: new Set([tieConcept]),
        pinnedProductIds: [productC, productA],
        maxCards: 2,
      },
    );

    expect(deck.cards.map((card) => card.productId)).toEqual([
      productC,
      productA,
    ]);
  });
});

describe("buildTieMateActionPaths", () => {
  it("wires save/order/advisor handoffs into existing surfaces", () => {
    const paths = buildTieMateActionPaths({
      slug: "maison-demo",
      productSlug: "navy-grenadine",
      productId: productA,
      productIdsForSwipe: [productA, productB],
    });

    expect(paths.deckPath).toBe("/r/maison-demo/tie-mate");
    expect(paths.productPath).toBe("/r/maison-demo/products/navy-grenadine");
    expect(paths.orderPath).toBe("/r/maison-demo/products/navy-grenadine");
    expect(paths.wishlistHint).toBe("wishlist_via_swipe_save");
    expect(paths.messagesPath).toBe("/messages");
    expect(paths.swipeHandoffPath).toContain("/r/maison-demo/swipe?");
    expect(paths.swipeHandoffPath).toContain(
      `products=${productA}%2C${productB}`,
    );
    expect(paths.appointmentPath).toContain("/r/maison-demo/appointments?");
    expect(paths.appointmentPath).toContain(
      `shortlist=${productA}%2C${productB}`,
    );
  });
});

describe("TIE_MATE_FABRIC_PHOTO_GUIDANCE", () => {
  it("documents sharp close-up ingestion onto swatchImageUrl", () => {
    expect(TIE_MATE_FABRIC_PHOTO_GUIDANCE.preferredField).toBe(
      "swatchImageUrl",
    );
    expect(TIE_MATE_FABRIC_PHOTO_GUIDANCE.requirements.length).toBeGreaterThan(
      0,
    );
  });
});

describe("resolveTieMateKeyboardAction", () => {
  it("maps ArrowLeft to skip and ArrowRight to save only", () => {
    expect(resolveTieMateKeyboardAction("ArrowLeft")).toBe("skip");
    expect(resolveTieMateKeyboardAction("ArrowRight")).toBe("save");
    expect(resolveTieMateKeyboardAction("ArrowUp")).toBeNull();
    expect(resolveTieMateKeyboardAction("ArrowDown")).toBeNull();
    expect(resolveTieMateKeyboardAction("Enter")).toBeNull();
    expect(resolveTieMateKeyboardAction(" ")).toBeNull();
    expect(resolveTieMateKeyboardAction("s")).toBeNull();
  });
});
