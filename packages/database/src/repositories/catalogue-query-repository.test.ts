import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { CatalogueQueryRepository } from "./catalogue-query-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductVariantRow =
  Database["public"]["Tables"]["product_variants"]["Row"];
type AssignmentRow =
  Database["public"]["Tables"]["entity_metadata_assignments"]["Row"];
type ConceptRow = Database["public"]["Tables"]["metadata_concepts"]["Row"];
type FabricProfileRow =
  Database["public"]["Tables"]["product_fabric_profiles"]["Row"];

const retailerId = "11111111-1111-1111-1111-111111111111";
const productA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const productB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const productC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const millId = "10000000-0000-4000-8000-000000000001";
const weaveId = "10000000-0000-4000-8000-000000000002";
const weddingId = "10000000-0000-4000-8000-000000000003";
const rejectedConcept = "10000000-0000-4000-8000-000000000099";

function product(id: string, slug: string, createdAt: string): ProductRow {
  return {
    id,
    retailer_id: retailerId,
    name: slug,
    slug,
    description: "",
    status: "active",
    is_made_to_order: true,
    is_alterable: true,
    primary_image_url: null,
    swatch_image_url: null,
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: null,
  };
}

function variant(
  id: string,
  productId: string,
  price: number,
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
    inventory_quantity: 1,
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
): ConceptRow {
  return {
    id,
    retailer_id: null,
    kind,
    slug,
    canonical_name: slug,
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

function fabric(
  id: string,
  productId: string,
  weight: number,
): FabricProfileRow {
  return {
    id,
    retailer_id: retailerId,
    product_id: productId,
    product_variant_id: null,
    fabric_weight_grams_per_square_metre: weight,
    supplier_reference: null,
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
  product(productA, "alpha-suit", "2026-07-20T00:00:00.000Z"),
  product(productB, "bravo-suit", "2026-07-10T00:00:00.000Z"),
  product(productC, "charlie-suit", "2026-07-01T00:00:00.000Z"),
];

const variants = [
  variant("va000000-0000-4000-8000-000000000001", productA, 85000),
  variant("vb000000-0000-4000-8000-000000000002", productB, 125000),
  variant("vc000000-0000-4000-8000-000000000003", productC, 95000),
];

const concepts = [
  concept(millId, "mill", "loro-piana"),
  concept(weaveId, "weave", "twill"),
  concept(weddingId, "occasion", "wedding"),
  concept(rejectedConcept, "colour", "navy"),
];

const acceptedAssignments = [
  assignment(
    "20000000-0000-4000-8000-000000000001",
    productA,
    millId,
    "accepted",
  ),
  assignment(
    "20000000-0000-4000-8000-000000000002",
    productA,
    weaveId,
    "accepted",
  ),
  assignment(
    "20000000-0000-4000-8000-000000000003",
    productA,
    weddingId,
    "accepted",
  ),
  assignment(
    "20000000-0000-4000-8000-000000000004",
    productB,
    millId,
    "accepted",
  ),
  // rejected must never enter candidates / facets
  assignment(
    "20000000-0000-4000-8000-000000000099",
    productC,
    rejectedConcept,
    "rejected",
  ),
];

const fabrics = [
  fabric("30000000-0000-4000-8000-000000000001", productA, 240),
  fabric("30000000-0000-4000-8000-000000000002", productB, 320),
  fabric("30000000-0000-4000-8000-000000000003", productC, 260),
];

describe("CatalogueQueryRepository", () => {
  it("projects only accepted assignments and supports concept + range filters", async () => {
    const repo = new CatalogueQueryRepository(
      clientWith({
        products,
        product_variants: variants,
        entity_metadata_assignments: acceptedAssignments,
        product_fabric_profiles: fabrics,
        metadata_concepts: concepts,
      }),
    );

    const candidates = await repo.projectCandidates(retailerId as never);
    expect(
      candidates.find((c) => c.productId === productA)?.acceptedConceptIds,
    ).toEqual(expect.arrayContaining([millId, weaveId, weddingId]));
    expect(
      candidates.find((c) => c.productId === productC)?.acceptedConceptIds,
    ).toEqual([]);

    const filtered = await repo.search({
      retailerId: retailerId as never,
      conceptIds: [millId as never, weaveId as never],
      ranges: { maxWeight: 280, maxPriceMinor: 100000 },
      sort: "price_asc",
      page: 1,
      pageSize: 10,
    });

    expect(filtered.hits.map((h) => h.productId)).toEqual([productA]);
    expect(filtered.total).toBe(1);
  });

  it("paginates and excludes rejected metadata from facets", async () => {
    const repo = new CatalogueQueryRepository(
      clientWith({
        products,
        product_variants: variants,
        entity_metadata_assignments: acceptedAssignments,
        product_fabric_profiles: fabrics,
        metadata_concepts: concepts,
      }),
    );

    const page1 = await repo.search({
      retailerId: retailerId as never,
      conceptIds: [millId as never],
      sort: "newest",
      page: 1,
      pageSize: 1,
    });
    expect(page1.hits).toHaveLength(1);
    expect(page1.total).toBe(2);

    const facets = await repo.listFacets(retailerId as never);
    const colourFacets = facets.byKind.colour ?? [];
    expect(colourFacets.map((f) => f.conceptId)).not.toContain(rejectedConcept);
    expect(facets.byKind.mill?.map((f) => f.slug)).toContain("loro-piana");
  });

  it("maps known intent and reports unresolved language without fabricated hits", async () => {
    const repo = new CatalogueQueryRepository(
      clientWith({
        products,
        product_variants: variants,
        entity_metadata_assignments: acceptedAssignments,
        product_fabric_profiles: fabrics,
        metadata_concepts: concepts,
      }),
    );

    const wedding = await repo.search({
      retailerId: retailerId as never,
      query: "summer wedding",
      sort: "relevance",
      page: 1,
      pageSize: 10,
    });
    expect(wedding.hits.map((h) => h.productId)).toEqual([productA]);
    expect(wedding.unresolvedQueryTokens).toEqual([]);

    const unresolved = await repo.search({
      retailerId: retailerId as never,
      query: "purple spaceship",
      sort: "relevance",
      page: 1,
      pageSize: 10,
    });
    expect(unresolved.hits).toEqual([]);
    expect(unresolved.total).toBe(0);
    expect(unresolved.unresolvedQueryTokens).toEqual(
      expect.arrayContaining(["purple", "spaceship"]),
    );
  });

  it("keeps an explicit accepted-assignment filter in the query path", async () => {
    const eq = vi.fn();
    const assignmentBuilder = fakeQueryBuilder({
      data: acceptedAssignments,
      error: null,
    });
    assignmentBuilder.eq = (...args: Parameters<typeof eq>) => {
      eq(...args);
      return assignmentBuilder;
    };
    const repo = new CatalogueQueryRepository({
      from: (table: string) => {
        if (table === "products") {
          return fakeQueryBuilder({ data: products, error: null });
        }
        if (table === "product_variants") {
          return fakeQueryBuilder({ data: variants, error: null });
        }
        if (table === "product_fabric_profiles") {
          return fakeQueryBuilder({ data: fabrics, error: null });
        }
        if (table === "entity_metadata_assignments") {
          return assignmentBuilder;
        }
        return fakeQueryBuilder({ data: [], error: null });
      },
    } as unknown as PaonSupabaseClient);

    await repo.projectCandidates(retailerId as never);
    expect(eq).toHaveBeenCalledWith("review_status", "accepted");
  });
});
