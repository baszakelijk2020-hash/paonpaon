import {
  asId,
  type CollectionId,
  type Product,
  type ProductId,
  type ProductStatus,
  type RetailerId,
} from "@paon/domain";
import type { PostgrestError } from "@supabase/supabase-js";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

const UNIQUE_VIOLATION = "23505";

export class ProductSlugAlreadyExistsError extends Error {
  constructor(public readonly slug: string) {
    super(`A product with slug "${slug}" already exists.`);
    this.name = "ProductSlugAlreadyExistsError";
  }
}

function isUniqueViolation(error: PostgrestError): boolean {
  return error.code === UNIQUE_VIOLATION;
}

function toDomain(row: ProductRow, collectionIds: CollectionId[]): Product {
  return {
    id: asId<"ProductId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    isMadeToOrder: row.is_made_to_order,
    isAlterable: row.is_alterable,
    collectionIds,
    ...(row.primary_image_url
      ? { primaryImageUrl: row.primary_image_url }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateProductParams {
  retailerId: RetailerId;
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  isMadeToOrder: boolean;
  isAlterable: boolean;
}

export interface UpdateProductParams {
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  isMadeToOrder: boolean;
  isAlterable: boolean;
  primaryImageUrl?: string;
  collectionIds: readonly CollectionId[];
}

/**
 * `collectionIds` (required, never optional, on the `Product` domain
 * type) is populated from `product_collections` here — a separate join
 * table, not a column on `products` — see
 * `supabase/migrations/20260719000010_create_products.sql`.
 */
export class ProductRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  private async collectionIdsByProduct(
    productIds: string[],
  ): Promise<Map<string, CollectionId[]>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.client
      .from("product_collections")
      .select("product_id, collection_id")
      .in("product_id", productIds);

    if (error) {
      throw error;
    }

    const byProduct = new Map<string, CollectionId[]>();
    for (const row of data) {
      const existing = byProduct.get(row.product_id) ?? [];
      existing.push(asId<"CollectionId">(row.collection_id));
      byProduct.set(row.product_id, existing);
    }
    return byProduct;
  }

  async findById(id: ProductId): Promise<Product | null> {
    const { data, error } = await this.client
      .from("products")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }

    const collectionIds = await this.collectionIdsByProduct([data.id]);
    return toDomain(data, collectionIds.get(data.id) ?? []);
  }

  async findBySlug(
    retailerId: RetailerId,
    slug: string,
  ): Promise<Product | null> {
    const { data, error } = await this.client
      .from("products")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }

    const collectionIds = await this.collectionIdsByProduct([data.id]);
    return toDomain(data, collectionIds.get(data.id) ?? []);
  }

  async findByRetailer(retailerId: RetailerId): Promise<Product[]> {
    const { data, error } = await this.client
      .from("products")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const collectionIds = await this.collectionIdsByProduct(
      data.map((row) => row.id),
    );
    return data.map((row) => toDomain(row, collectionIds.get(row.id) ?? []));
  }

  async create(params: CreateProductParams): Promise<Product> {
    const { data, error } = await this.client
      .from("products")
      .insert({
        retailer_id: params.retailerId,
        name: params.name,
        slug: params.slug,
        description: params.description,
        status: params.status,
        is_made_to_order: params.isMadeToOrder,
        is_alterable: params.isAlterable,
      })
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        throw new ProductSlugAlreadyExistsError(params.slug);
      }
      throw error;
    }

    return toDomain(data, []);
  }

  async update(id: ProductId, params: UpdateProductParams): Promise<Product> {
    const { error } = await this.client.rpc("update_product_catalogue", {
      p_product_id: id,
      p_name: params.name,
      p_slug: params.slug,
      p_description: params.description,
      p_status: params.status,
      p_is_made_to_order: params.isMadeToOrder,
      p_is_alterable: params.isAlterable,
      p_primary_image_url: params.primaryImageUrl ?? "",
      p_collection_ids: [...params.collectionIds],
    });
    if (error) {
      if (isUniqueViolation(error))
        throw new ProductSlugAlreadyExistsError(params.slug);
      throw error;
    }
    const updated = await this.findById(id);
    if (!updated) throw new Error("Updated product could not be reloaded");
    return updated;
  }
}
