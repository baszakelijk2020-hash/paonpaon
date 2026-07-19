import { asId, type Retailer, type RetailerId } from "@paon/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../generated/database.types";

type RetailerRow = Database["public"]["Tables"]["retailers"]["Row"];

function toDomain(row: RetailerRow): Retailer {
  return {
    id: asId<"RetailerId">(row.id),
    legalName: row.legal_name,
    displayName: row.display_name,
    slug: row.slug,
    status: row.status,
    tier: row.tier,
    ...(row.primary_domain ? { primaryDomain: row.primary_domain } : {}),
    billingAddress:
      row.billing_address as unknown as Retailer["billingAddress"],
    defaultCurrency: row.default_currency,
    defaultLocale: row.default_locale,
    brandTheme: row.brand_theme as unknown as Retailer["brandTheme"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Reference implementation of the repository pattern every domain
 * aggregate follows: one repository per aggregate root, constructed
 * with an already-authenticated Supabase client (never a bare URL/key),
 * translating between `Database["public"]["Tables"]` rows and
 * `@paon/domain` entities. See ARCHITECTURE.md "Data Access Layer".
 */
export class RetailerRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findById(id: RetailerId): Promise<Retailer | null> {
    const { data, error } = await this.client
      .from("retailers")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toDomain(data) : null;
  }

  async findBySlug(slug: string): Promise<Retailer | null> {
    const { data, error } = await this.client
      .from("retailers")
      .select("*")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toDomain(data) : null;
  }
}
