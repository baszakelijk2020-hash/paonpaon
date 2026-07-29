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

const retailerId = "11111111-1111-1111-1111-111111111111";
const tieConceptId = "22222222-2222-4222-8222-222222222201";
const jacketConceptId = "22222222-2222-4222-8222-222222222202";
const tieProductId = "33333333-3333-4333-8333-333333333301";
const jacketProductId = "33333333-3333-4333-8333-333333333302";
const tieVariantId = "44444444-4444-4444-8444-444444444401";
const jacketVariantId = "44444444-4444-4444-8444-444444444402";

function product(
  id: string,
  slug: string,
  overrides: Partial<ProductRow> = {},
): ProductRow {
  return {
    id,
    retailer_id: retailerId,
    name: slug,
    slug,
    description: "",
    status: "active",
    is_made_to_order: false,
    is_alterable: true,
    primary_image_url: "https://cdn.example/hero.jpg",
    swatch_image_url: "https://cdn.example/swatch.jpg",
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function variant(
  id: string,
  productId: string,
  inventory = 2,
): ProductVariantRow {
  return {
    id,
    product_id: productId,
    sku: `SKU-${id.slice(0, 8)}`,
    size: null,
    color: null,
    price_amount_minor_units: 9500,
    price_currency: "EUR",
    compare_at_price_amount_minor_units: null,
    compare_at_price_currency: null,
    inventory_quantity: inventory,
    lead_time_days: null,
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z",
    deleted_at: null,
  };
}

function assignment(productId: string, conceptId: string): AssignmentRow {
  return {
    id: `assign-${productId}-${conceptId}`,
    retailer_id: retailerId,
    target_type: "product",
    target_id: productId,
    concept_id: conceptId,
    source: "retailer",
    confidence: 1,
    review_status: "accepted",
    supplier_value: null,
    evidence: null,
    reviewed_by_staff_id: null,
    reviewed_at: null,
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z",
    deleted_at: null,
  };
}

function concept(
  id: string,
  kind: ConceptRow["kind"],
  slug: string,
  label: string,
): ConceptRow {
  return {
    id,
    retailer_id: null,
    kind,
    slug,
    canonical_name: label,
    attributes: {},
    image_url: null,
    active: true,
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z",
    deleted_at: null,
  };
}

function clientFromTables(tables: {
  products?: ProductRow[];
  product_variants?: ProductVariantRow[];
  entity_metadata_assignments?: AssignmentRow[];
  metadata_concepts?: ConceptRow[];
}): PaonSupabaseClient {
  return {
    from: vi.fn((table: keyof typeof tables) =>
      fakeQueryBuilder({ data: tables[table] ?? [], error: null }),
    ),
  } as unknown as PaonSupabaseClient;
}

describe("TieMateRepository", () => {
  it("projects active products with swatch URLs and accepted concepts per variant", async () => {
    const repo = new TieMateRepository(
      clientFromTables({
        products: [
          product(tieProductId, "navy-grenadine"),
          product(jacketProductId, "navy-jacket"),
        ],
        product_variants: [
          variant(tieVariantId, tieProductId),
          variant(jacketVariantId, jacketProductId),
        ],
        entity_metadata_assignments: [
          assignment(tieProductId, tieConceptId),
          assignment(jacketProductId, jacketConceptId),
        ],
      }),
    );

    const candidates = await repo.projectFabricCandidates(retailerId as never);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      productSlug: "navy-grenadine",
      swatchImageUrl: "https://cdn.example/swatch.jpg",
      primaryImageUrl: "https://cdn.example/hero.jpg",
      inventoryQuantity: 2,
      acceptedConceptIds: [tieConceptId],
    });
  });

  it("builds a neckwear-only deck preferring swatch close-ups", async () => {
    const repo = new TieMateRepository(
      clientFromTables({
        products: [
          product(tieProductId, "navy-grenadine"),
          product(jacketProductId, "navy-jacket"),
          product("33333333-3333-4333-8333-333333333303", "sold-out-tie", {
            swatch_image_url: null,
            primary_image_url: "https://cdn.example/fallback.jpg",
          }),
        ],
        product_variants: [
          variant(tieVariantId, tieProductId),
          variant(jacketVariantId, jacketProductId),
          variant(
            "44444444-4444-4444-8444-444444444403",
            "33333333-3333-4333-8333-333333333303",
            0,
          ),
        ],
        entity_metadata_assignments: [
          assignment(tieProductId, tieConceptId),
          assignment(jacketProductId, jacketConceptId),
          assignment("33333333-3333-4333-8333-333333333303", tieConceptId),
        ],
        metadata_concepts: [
          concept(tieConceptId, "garment_type", "silk-tie", "Silk Tie"),
          concept(jacketConceptId, "garment_type", "jacket", "Jacket"),
        ],
      }),
    );

    const deck = await repo.buildDeck({
      retailerId: retailerId as never,
      slug: "maison-demo",
    });

    expect(deck.cards).toHaveLength(1);
    expect(deck.cards[0]).toMatchObject({
      productSlug: "navy-grenadine",
      fabricImageUrl: "https://cdn.example/swatch.jpg",
      fabricPhotoRole: "swatch_closeup",
      inStock: true,
    });
    expect(deck.skippedNotTie).toBe(1);
    expect(deck.skippedOutOfStock).toBe(1);
  });

  it("returns empty projections when the retailer has no active products", async () => {
    const repo = new TieMateRepository(
      clientFromTables({
        products: [],
      }),
    );

    await expect(
      repo.projectFabricCandidates(retailerId as never),
    ).resolves.toEqual([]);
  });
});
