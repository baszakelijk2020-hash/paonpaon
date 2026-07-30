import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";
import { TieMateRepository } from "./tie-mate-repository";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductVariantRow =
  Database["public"]["Tables"]["product_variants"]["Row"];
type AssignmentRow =
  Database["public"]["Tables"]["entity_metadata_assignments"]["Row"];
type ConceptRow = Database["public"]["Tables"]["metadata_concepts"]["Row"];

const retailerId = "11111111-1111-4111-8111-111111111111";
const otherRetailerId = "22222222-2222-4222-8222-222222222222";
const tieProduct = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const jacketProduct = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const draftTie = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const outOfStockTie = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const noPhotoTie = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const tieConceptId = "10000000-0000-4000-8000-000000000001";
const jacketConceptId = "10000000-0000-4000-8000-000000000002";
const pendingConceptId = "10000000-0000-4000-8000-000000000099";
const tieVariant = "va000000-0000-4000-8000-000000000001";
const jacketVariant = "vb000000-0000-4000-8000-000000000002";
const draftVariant = "vc000000-0000-4000-8000-000000000003";
const oosVariant = "vd000000-0000-4000-8000-000000000004";
const noPhotoVariant = "ve000000-0000-4000-8000-000000000005";

function product(
  overrides: Partial<ProductRow> & Pick<ProductRow, "id" | "slug" | "name">,
): ProductRow {
  return {
    retailer_id: retailerId,
    description: "",
    status: "active",
    is_made_to_order: false,
    is_alterable: true,
    primary_image_url: null,
    swatch_image_url: null,
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function variant(
  id: string,
  productId: string,
  inventoryQuantity: number,
  price = 9500,
): ProductVariantRow {
  return {
    id,
    product_id: productId,
    sku: `SKU-${id.slice(0, 8)}`,
    size: null,
    color: null,
    price_amount_minor_units: price,
    price_currency: "EUR",
    compare_at_price_amount_minor_units: null,
    compare_at_price_currency: null,
    inventory_quantity: inventoryQuantity,
    lead_time_days: null,
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z",
    deleted_at: null,
  };
}

function concept(
  id: string,
  kind: ConceptRow["kind"],
  slug: string,
  canonicalName: string,
): ConceptRow {
  return {
    id,
    retailer_id: null,
    kind,
    slug,
    canonical_name: canonicalName,
    attributes: {},
    image_url: null,
    active: true,
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z",
    deleted_at: null,
  };
}

function assignment(
  id: string,
  productId: string,
  conceptId: string,
  reviewStatus: AssignmentRow["review_status"],
): AssignmentRow {
  return {
    id,
    retailer_id: retailerId,
    target_type: "product",
    target_id: productId,
    concept_id: conceptId,
    source: "retailer",
    confidence: 1,
    review_status: reviewStatus,
    supplier_value: null,
    evidence: null,
    reviewed_by_staff_id: null,
    reviewed_at: null,
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z",
    deleted_at: null,
  };
}

function clientWith(tables: Record<string, unknown>): PaonSupabaseClient {
  return {
    from: (table: string) =>
      fakeQueryBuilder({
        data: tables[table],
        error: null,
      }),
  } as unknown as PaonSupabaseClient;
}

const products = [
  product({
    id: tieProduct,
    slug: "navy-grenadine",
    name: "Navy Grenadine",
    swatch_image_url: "https://cdn.example/swatch-navy.jpg",
    primary_image_url: "https://cdn.example/hero-navy.jpg",
  }),
  product({
    id: jacketProduct,
    slug: "hopsack-jacket",
    name: "Hopsack Jacket",
    primary_image_url: "https://cdn.example/jacket.jpg",
  }),
  product({
    id: draftTie,
    slug: "draft-tie",
    name: "Draft Tie",
    status: "draft",
    swatch_image_url: "https://cdn.example/draft.jpg",
  }),
  product({
    id: outOfStockTie,
    slug: "sold-out-tie",
    name: "Sold Out Tie",
    swatch_image_url: "https://cdn.example/oos.jpg",
  }),
  product({
    id: noPhotoTie,
    slug: "no-photo-tie",
    name: "No Photo Tie",
  }),
];

const variants = [
  variant(tieVariant, tieProduct, 4),
  variant(jacketVariant, jacketProduct, 2),
  variant(draftVariant, draftTie, 1),
  variant(oosVariant, outOfStockTie, 0),
  variant(noPhotoVariant, noPhotoTie, 3),
];

const concepts = [
  concept(tieConceptId, "garment_type", "silk-tie", "Silk Tie"),
  concept(jacketConceptId, "garment_type", "jacket", "Jacket"),
  concept(pendingConceptId, "garment_type", "bow-tie", "Bow Tie"),
];

const assignments = [
  assignment(
    "20000000-0000-4000-8000-000000000001",
    tieProduct,
    tieConceptId,
    "accepted",
  ),
  assignment(
    "20000000-0000-4000-8000-000000000002",
    jacketProduct,
    jacketConceptId,
    "accepted",
  ),
  assignment(
    "20000000-0000-4000-8000-000000000003",
    draftTie,
    tieConceptId,
    "accepted",
  ),
  assignment(
    "20000000-0000-4000-8000-000000000004",
    outOfStockTie,
    tieConceptId,
    "accepted",
  ),
  assignment(
    "20000000-0000-4000-8000-000000000005",
    noPhotoTie,
    tieConceptId,
    "accepted",
  ),
  // pending must never enter candidates
  assignment(
    "20000000-0000-4000-8000-000000000099",
    tieProduct,
    pendingConceptId,
    "pending",
  ),
];

describe("TieMateRepository", () => {
  it("scopes product and assignment reads to the retailer", async () => {
    const eq = vi.fn();
    const builder = fakeQueryBuilder({ data: [], error: null });
    builder.eq = (...args: Parameters<typeof eq>) => {
      eq(...args);
      return builder;
    };
    const from = vi.fn(() => builder);
    const repo = new TieMateRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await repo.projectFabricCandidates(retailerId as never);

    expect(eq).toHaveBeenCalledWith("retailer_id", retailerId);
    expect(eq).not.toHaveBeenCalledWith("retailer_id", otherRetailerId);
  });

  it("projects accepted concepts, prefers swatch photos, and builds a stock-truthful deck", async () => {
    const repo = new TieMateRepository(
      clientWith({
        products,
        product_variants: variants,
        entity_metadata_assignments: assignments,
        metadata_concepts: concepts,
      }),
    );

    const candidates = await repo.projectFabricCandidates(retailerId as never);
    const navy = candidates.find((c) => c.productId === tieProduct);
    expect(navy).toMatchObject({
      productSlug: "navy-grenadine",
      swatchImageUrl: "https://cdn.example/swatch-navy.jpg",
      inventoryQuantity: 4,
      acceptedConceptIds: [tieConceptId],
    });
    expect(navy?.acceptedConceptIds).not.toContain(pendingConceptId);

    const deck = await repo.buildDeck({
      retailerId: retailerId as never,
      slug: "maison-demo",
      maxCards: 10,
    });

    expect(deck.cards).toHaveLength(1);
    expect(deck.cards[0]).toMatchObject({
      productId: tieProduct,
      fabricImageUrl: "https://cdn.example/swatch-navy.jpg",
      fabricPhotoRole: "swatch_closeup",
      inStock: true,
      matchedTieConceptIds: [tieConceptId],
    });
    expect(deck.skippedNotTie).toBeGreaterThanOrEqual(1);
    expect(deck.skippedInactive).toBeGreaterThanOrEqual(1);
    expect(deck.skippedOutOfStock).toBeGreaterThanOrEqual(1);
    expect(deck.skippedWithoutPhoto).toBeGreaterThanOrEqual(1);
  });

  it("pins shortlisted products first when eligible", async () => {
    const secondTie = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const secondVariant = "vf000000-0000-4000-8000-000000000006";
    const repo = new TieMateRepository(
      clientWith({
        products: [
          ...products,
          product({
            id: secondTie,
            slug: "burgundy-knit",
            name: "Burgundy Knit",
            swatch_image_url: "https://cdn.example/burgundy.jpg",
            created_at: "2026-07-29T00:00:00.000Z",
          }),
        ],
        product_variants: [
          ...variants,
          variant(secondVariant, secondTie, 2, 8900),
        ],
        entity_metadata_assignments: [
          ...assignments,
          assignment(
            "20000000-0000-4000-8000-000000000006",
            secondTie,
            tieConceptId,
            "accepted",
          ),
        ],
        metadata_concepts: concepts,
      }),
    );

    const deck = await repo.buildDeck({
      retailerId: retailerId as never,
      slug: "maison-demo",
      pinnedProductIds: [secondTie as never],
    });

    expect(deck.cards.map((c) => c.productId)).toEqual([secondTie, tieProduct]);
  });

  it("resolves only neckwear garment_type concepts", async () => {
    const repo = new TieMateRepository(
      clientWith({
        products: [],
        product_variants: [],
        entity_metadata_assignments: [],
        metadata_concepts: concepts,
      }),
    );

    const ids = await repo.resolveTieConceptIdsForRetailer(retailerId as never);
    expect([...ids]).toEqual([tieConceptId, pendingConceptId]);
  });

  it("builds an empty deck when neckwear is only out of stock or photo-less", async () => {
    const repo = new TieMateRepository(
      clientWith({
        products: [
          product({
            id: outOfStockTie,
            slug: "sold-out-tie",
            name: "Sold Out Tie",
            swatch_image_url: "https://cdn.example/oos.jpg",
          }),
          product({
            id: noPhotoTie,
            slug: "no-photo-tie",
            name: "No Photo Tie",
          }),
        ],
        product_variants: [
          variant(oosVariant, outOfStockTie, 0),
          variant(noPhotoVariant, noPhotoTie, 3),
        ],
        entity_metadata_assignments: [
          assignment(
            "20000000-0000-4000-8000-000000000004",
            outOfStockTie,
            tieConceptId,
            "accepted",
          ),
          assignment(
            "20000000-0000-4000-8000-000000000005",
            noPhotoTie,
            tieConceptId,
            "accepted",
          ),
        ],
        metadata_concepts: concepts,
      }),
    );

    const deck = await repo.buildDeck({
      retailerId: retailerId as never,
      slug: "maison-demo",
    });

    expect(deck.cards).toEqual([]);
    expect(deck.skippedOutOfStock).toBe(1);
    expect(deck.skippedWithoutPhoto).toBe(1);
  });
});
