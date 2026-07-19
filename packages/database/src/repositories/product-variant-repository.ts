import {
  asId,
  money,
  type CurrencyCode,
  type ProductId,
  type ProductVariant,
  type ProductVariantId,
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
}
