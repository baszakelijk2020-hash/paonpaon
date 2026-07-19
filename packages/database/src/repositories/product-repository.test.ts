import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import {
  ProductRepository,
  ProductSlugAlreadyExistsError,
} from "./product-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

const row: ProductRow = {
  id: "77777777-7777-7777-7777-777777777777",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  name: "Bespoke Wool Overcoat",
  slug: "bespoke-wool-overcoat",
  description: "",
  status: "draft",
  is_made_to_order: true,
  is_alterable: true,
  primary_image_url: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

/** Dispatches by table name — ProductRepository queries both `products` and `product_collections`. */
function clientWith(
  tables: Record<string, { data: unknown; error: unknown }>,
): PaonSupabaseClient {
  return {
    from: (table: string) => fakeQueryBuilder(tables[table] as never),
  } as unknown as PaonSupabaseClient;
}

describe("ProductRepository", () => {
  it("maps a row to a domain Product with its collectionIds", async () => {
    const client = clientWith({
      products: { data: row, error: null },
      product_collections: {
        data: [{ product_id: row.id, collection_id: "collection-1" }],
        error: null,
      },
    });
    const repo = new ProductRepository(client);
    const product = await repo.findById(row.id as never);

    expect(product?.name).toBe("Bespoke Wool Overcoat");
    expect(product?.collectionIds).toEqual(["collection-1"]);
    expect(product?.isMadeToOrder).toBe(true);
  });

  it("returns an empty collectionIds array when there are no joins", async () => {
    const client = clientWith({
      products: { data: row, error: null },
      product_collections: { data: [], error: null },
    });
    const repo = new ProductRepository(client);
    const product = await repo.findById(row.id as never);
    expect(product?.collectionIds).toEqual([]);
  });

  it("returns null when no row is found", async () => {
    const client = clientWith({
      products: { data: null, error: null },
      product_collections: { data: [], error: null },
    });
    const repo = new ProductRepository(client);
    const product = await repo.findById("missing" as never);
    expect(product).toBeNull();
  });

  it("findBySlug maps a row to a domain Product", async () => {
    const client = clientWith({
      products: { data: row, error: null },
      product_collections: { data: [], error: null },
    });
    const repo = new ProductRepository(client);
    const product = await repo.findBySlug(row.retailer_id as never, row.slug);
    expect(product?.slug).toBe("bespoke-wool-overcoat");
  });

  it("findBySlug returns null when no row is found", async () => {
    const client = clientWith({
      products: { data: null, error: null },
      product_collections: { data: [], error: null },
    });
    const repo = new ProductRepository(client);
    const product = await repo.findBySlug(row.retailer_id as never, "missing");
    expect(product).toBeNull();
  });

  it("throws ProductSlugAlreadyExistsError on a unique constraint violation", async () => {
    const client = clientWith({
      products: { data: null, error: { code: "23505", message: "duplicate" } },
      product_collections: { data: [], error: null },
    });
    const repo = new ProductRepository(client);

    await expect(
      repo.create({
        retailerId: row.retailer_id as never,
        name: row.name,
        slug: row.slug,
        description: "",
        status: "draft",
        isMadeToOrder: true,
        isAlterable: true,
      }),
    ).rejects.toBeInstanceOf(ProductSlugAlreadyExistsError);
  });

  it("updates product metadata and collection membership transactionally", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: row.id, error: null });
    const client = {
      rpc,
      from: (table: string) =>
        fakeQueryBuilder(
          (table === "products"
            ? { data: { ...row, status: "active" }, error: null }
            : {
                data: [
                  {
                    product_id: row.id,
                    collection_id: "55555555-5555-5555-5555-555555555555",
                  },
                ],
                error: null,
              }) as never,
        ),
    } as unknown as PaonSupabaseClient;
    const product = await new ProductRepository(client).update(
      row.id as never,
      {
        name: row.name,
        slug: row.slug,
        description: "Updated",
        status: "active",
        isMadeToOrder: true,
        isAlterable: true,
        collectionIds: ["55555555-5555-5555-5555-555555555555" as never],
      },
    );
    expect(rpc).toHaveBeenCalledWith(
      "update_product_catalogue",
      expect.objectContaining({ p_product_id: row.id, p_status: "active" }),
    );
    expect(product.collectionIds).toHaveLength(1);
  });
});
