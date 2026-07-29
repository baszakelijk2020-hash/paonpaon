import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { CatalogueQueryRepository } from "./catalogue-query-repository";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730030000_add_catalogue_query.sql",
    import.meta.url,
  ),
  "utf8",
);

const retailerId = "11111111-1111-1111-1111-111111111111";
const productId = "22222222-2222-2222-2222-222222222222";
const conceptId = "33333333-3333-3333-3333-333333333333";

describe("catalogue query migration contract", () => {
  it("creates indexed search paths for retailer, assignment, price, and weight", () => {
    expect(migration).toContain("products_active_retailer_created_idx");
    expect(migration).toContain("product_variants_active_price_idx");
    expect(migration).toContain("product_fabric_profiles_retailer_weight_idx");
    expect(migration).toContain("review_status = 'accepted'");
  });

  it("defines repository-backed search and facet RPC helpers", () => {
    expect(migration).toContain(
      "create or replace function public.search_catalogue_products",
    );
    expect(migration).toContain(
      "create or replace function public.list_catalogue_facets",
    );
    expect(migration).toContain("p_min_price_minor");
    expect(migration).toContain("p_max_weight");
  });
});

describe("CatalogueQueryRepository", () => {
  it("maps search RPC rows into domain hits with pagination metadata", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            product_id: productId,
            relevance_score: 4,
            total_count: 1,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            concept_id: conceptId,
            concept_kind: "colour",
            concept_slug: "navy",
            concept_label: "Navy",
            product_count: 1,
          },
        ],
        error: null,
      });

    const repository = new CatalogueQueryRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    const result = await repository.search({
      retailerId: retailerId as never,
      query: "navy suit",
      sort: "relevance",
      page: 1,
      pageSize: 24,
    });

    expect(rpc).toHaveBeenNthCalledWith(1, "search_catalogue_products", {
      p_retailer_id: retailerId,
      p_query: "navy suit",
      p_concept_ids: null,
      p_min_weight: null,
      p_max_weight: null,
      p_min_price_minor: null,
      p_max_price_minor: null,
      p_sort: "relevance",
      p_page: 1,
      p_page_size: 24,
    });
    expect(result.totalCount).toBe(1);
    expect(result.hits).toEqual([
      {
        productId,
        relevanceScore: 4,
      },
    ]);
    expect(result.facets[0]?.kind).toBe("colour");
  });

  it("excludes rejected metadata by delegating to accepted-assignment RPC filters", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const repository = new CatalogueQueryRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await repository.listFacets(retailerId as never);

    expect(rpc).toHaveBeenCalledWith("list_catalogue_facets", {
      p_retailer_id: retailerId,
    });
    expect(migration).toContain("assignment.review_status = 'accepted'");
  });

  it("passes resolved intent concept ids instead of keyword query", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const repository = new CatalogueQueryRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await repository.search(
      {
        retailerId: retailerId as never,
        query: "summer wedding suit",
        sort: "newest",
        page: 1,
        pageSize: 48,
      },
      [
        {
          id: conceptId as never,
          kind: "season",
          slug: "spring-summer",
          canonicalName: "Spring / Summer",
        },
        {
          id: "44444444-4444-4444-4444-444444444444" as never,
          kind: "occasion",
          slug: "wedding",
          canonicalName: "Wedding",
        },
      ],
    );

    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "search_catalogue_products",
      expect.objectContaining({
        p_query: null,
        p_concept_ids: expect.arrayContaining([
          conceptId,
          "44444444-4444-4444-4444-444444444444",
        ]),
      }),
    );
  });
});
