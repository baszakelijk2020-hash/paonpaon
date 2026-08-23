import {
  asId,
  money,
  type CurrencyCode,
  type ProductId,
  type ProductVariant,
  type ProductVariantId,
  type RetailerId,
} from "@paon/domain";
import type { PostgrestError } from "@supabase/supabase-js";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ProductVariantRow =
  Database["public"]["Tables"]["product_variants"]["Row"];

const UNIQUE_VIOLATION = "23505";

export class VariantSkuAlreadyExistsError extends Error {
  constructor(public readonly sku: string) {
    super(`A variant with SKU "${sku}" already exists for this product.`);
    this.name = "VariantSkuAlreadyExistsError";
  }
}

function isUniqueViolation(error: PostgrestError): boolean {
  return error.code === UNIQUE_VIOLATION;
}

function toDomain(row: ProductVariantRow): ProductVariant {
  return {
    id: asId<"ProductVariantId">(row.id),
    productId: asId<"ProductId">(row.product_id),
    sku: row.sku,
    ...(row.size ? { size: row.size } : {}),
    ...(row.color ? { color: row.color } : {}),
    // price_currency is an unconstrained `text` column (see the
    // migration) — CurrencyCode validation happens at the zod schema
    // boundary (currencyCodeSchema), same as Retailer.defaultCurrency.
    price: money(
      row.price_amount_minor_units,
      row.price_currency as CurrencyCode,
    ),
    ...(row.compare_at_price_amount_minor_units !== null &&
    row.compare_at_price_currency
      ? {
          compareAtPrice: money(
            row.compare_at_price_amount_minor_units,
            row.compare_at_price_currency as CurrencyCode,
          ),
        }
      : {}),
    inventoryQuantity: row.inventory_quantity,
    ...(row.lead_time_days !== null
      ? { leadTimeDays: row.lead_time_days }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateProductVariantParams {
  productId: ProductId;
  sku: string;
  size?: string;
  color?: string;
  price: { amountMinorUnits: number; currency: string };
  compareAtPrice?: { amountMinorUnits: number; currency: string };
  inventoryQuantity: number;
  leadTimeDays?: number;
}

export class ProductVariantRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /**
   * Lists variants through their owning product, which is the tenant
   * boundary for this legacy table. `product_variants` predates the
   * retailer_id invariant, so a bare select can legitimately see public
   * catalogue rows from another retailer and must never feed an operational
   * stock or POS surface.
   */
  async findForRetailer(
    retailerId: RetailerId,
    limit = 50,
  ): Promise<ProductVariant[]> {
    const { data, error } = await this.client
      .from("product_variants")
      .select("*, products!inner(retailer_id, deleted_at)")
      .eq("products.retailer_id", retailerId)
      .is("products.deleted_at", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data.map(toDomain);
  }

  async findByProduct(productId: ProductId): Promise<ProductVariant[]> {
    const { data, error } = await this.client
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  /**
   * Batch form of `findByProduct` — one round trip for many products
   * instead of one per product, for pages that render a full catalogue
   * (e.g. the storefront) where an N+1 query pattern otherwise dominates
   * response time.
   */
  async findByProducts(
    productIds: readonly ProductId[],
  ): Promise<Map<ProductId, ProductVariant[]>> {
    const byProduct = new Map<ProductId, ProductVariant[]>();
    if (productIds.length === 0) return byProduct;

    const { data, error } = await this.client
      .from("product_variants")
      .select("*")
      .in("product_id", productIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    for (const row of data) {
      const variant = toDomain(row);
      const list = byProduct.get(variant.productId);
      if (list) {
        list.push(variant);
      } else {
        byProduct.set(variant.productId, [variant]);
      }
    }
    return byProduct;
  }

  async findById(id: ProductVariantId): Promise<ProductVariant | null> {
    const { data, error } = await this.client
      .from("product_variants")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toDomain(data) : null;
  }

  async create(params: CreateProductVariantParams): Promise<ProductVariant> {
    const { data, error } = await this.client
      .from("product_variants")
      .insert({
        product_id: params.productId,
        sku: params.sku,
        size: params.size ?? null,
        color: params.color ?? null,
        price_amount_minor_units: params.price.amountMinorUnits,
        price_currency: params.price.currency,
        compare_at_price_amount_minor_units:
          params.compareAtPrice?.amountMinorUnits ?? null,
        compare_at_price_currency: params.compareAtPrice?.currency ?? null,
        inventory_quantity: params.inventoryQuantity,
        lead_time_days: params.leadTimeDays ?? null,
      })
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        throw new VariantSkuAlreadyExistsError(params.sku);
      }
      throw error;
    }

    return toDomain(data);
  }

  async update(
    id: ProductVariantId,
    params: Omit<CreateProductVariantParams, "productId">,
  ): Promise<ProductVariant> {
    const { data, error } = await this.client
      .from("product_variants")
      .update({
        sku: params.sku,
        size: params.size ?? null,
        color: params.color ?? null,
        price_amount_minor_units: params.price.amountMinorUnits,
        price_currency: params.price.currency,
        compare_at_price_amount_minor_units:
          params.compareAtPrice?.amountMinorUnits ?? null,
        compare_at_price_currency: params.compareAtPrice?.currency ?? null,
        inventory_quantity: params.inventoryQuantity,
        lead_time_days: params.leadTimeDays ?? null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      if (isUniqueViolation(error))
        throw new VariantSkuAlreadyExistsError(params.sku);
      throw error;
    }
    return toDomain(data);
  }

  /** Variants at or below threshold for a retailer (active products only). */
  async countLowStockForRetailer(
    retailerId: RetailerId,
    threshold = 5,
  ): Promise<number> {
    const { count, error } = await this.client
      .from("product_variants")
      .select("id, products!inner(retailer_id, deleted_at)", {
        count: "exact",
        head: true,
      })
      .eq("products.retailer_id", retailerId)
      .is("products.deleted_at", null)
      .lte("inventory_quantity", threshold)
      .is("deleted_at", null);
    if (error) throw error;
    return count ?? 0;
  }

  /** Same scope as `countLowStockForRetailer`, with the rows a "Products
   * running low" export needs — sku/name/quantity/productId, ordered
   * lowest-stock-first so the most urgent lines lead the export. */
  async findLowStockForRetailer(
    retailerId: RetailerId,
    threshold = 5,
  ): Promise<
    Array<{
      sku: string;
      productName: string;
      inventoryQuantity: number;
      productId: ProductId;
    }>
  > {
    const { data, error } = await this.client
      .from("product_variants")
      .select(
        "sku, inventory_quantity, product_id, products!inner(retailer_id, deleted_at, name)",
      )
      .eq("products.retailer_id", retailerId)
      .is("products.deleted_at", null)
      .lte("inventory_quantity", threshold)
      .is("deleted_at", null)
      .order("inventory_quantity", { ascending: true });
    if (error) throw error;
    return data.map((row) => {
      const joined = row.products as unknown as
        { name: string } | { name: string }[];
      const productName = Array.isArray(joined)
        ? (joined[0]?.name ?? "")
        : joined.name;
      return {
        sku: row.sku,
        productName,
        inventoryQuantity: row.inventory_quantity,
        productId: asId<"ProductId">(row.product_id),
      };
    });
  }
}
