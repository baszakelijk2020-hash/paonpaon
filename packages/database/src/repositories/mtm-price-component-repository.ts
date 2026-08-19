import {
  asId,
  type CreateMtmPriceComponentInput,
  type CurrencyCode,
  type MtmPriceComponent,
  type MtmPriceComponentCategory,
  type MtmPriceComponentId,
  type RetailerId,
  type UpdateMtmPriceComponentInput,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type MtmPriceComponentRow =
  Database["public"]["Tables"]["mtm_price_components"]["Row"];

function toDomain(row: MtmPriceComponentRow): MtmPriceComponent {
  return {
    id: asId<"MtmPriceComponentId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    category: row.category as MtmPriceComponentCategory,
    slug: row.slug,
    displayName: row.display_name,
    priceImpactMinorUnits: row.price_impact_minor_units,
    currency: row.currency as CurrencyCode,
    sortOrder: row.sort_order,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MtmPriceComponentRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /** Every active-or-not component for the caller's retailer, ordered for
   * display (category, then sort_order). Callers that only want claimable
   * (currently pricing) options should filter `active` themselves — RLS
   * already scopes retailer_id, so this is not a tenancy boundary. */
  async listForRetailer(
    retailerId: RetailerId,
  ): Promise<readonly MtmPriceComponent[]> {
    const { data, error } = await this.client
      .from("mtm_price_components")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data.map(toDomain);
  }

  async listByCategory(
    retailerId: RetailerId,
    category: MtmPriceComponentCategory,
  ): Promise<readonly MtmPriceComponent[]> {
    const { data, error } = await this.client
      .from("mtm_price_components")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("category", category)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data.map(toDomain);
  }

  async create(
    retailerId: RetailerId,
    input: CreateMtmPriceComponentInput,
  ): Promise<MtmPriceComponent> {
    const { data, error } = await this.client
      .from("mtm_price_components")
      .insert({
        retailer_id: retailerId,
        category: input.category,
        slug: input.slug,
        display_name: input.displayName,
        price_impact_minor_units: input.priceImpactMinorUnits,
        currency: input.currency,
        sort_order: input.sortOrder,
        active: input.active,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }

  /** RLS enforces the retailer/role boundary on the UPDATE itself; this
   * does not re-check tenancy in application code, matching this
   * repository's other write methods. A row outside the caller's retailer
   * simply matches zero rows rather than erroring, so the caller should
   * treat a null return as "not found or not yours", not distinguish
   * between the two. */
  async update(
    componentId: MtmPriceComponentId,
    input: UpdateMtmPriceComponentInput,
  ): Promise<MtmPriceComponent | null> {
    const { data, error } = await this.client
      .from("mtm_price_components")
      .update({
        ...(input.displayName !== undefined
          ? { display_name: input.displayName }
          : {}),
        ...(input.priceImpactMinorUnits !== undefined
          ? { price_impact_minor_units: input.priceImpactMinorUnits }
          : {}),
        ...(input.sortOrder !== undefined
          ? { sort_order: input.sortOrder }
          : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      })
      .eq("id", componentId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  /** No hard delete — a component that has ever priced a real quote must
   * stay resolvable for that quote's history. "Removing" a stale tier is
   * `update(id, { active: false })`, which computeMtmQuoteTotal already
   * refuses to price a NEW quote against, while leaving old quotes intact. */
}
