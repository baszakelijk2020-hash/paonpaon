import {
  asId,
  normalizeRetailerBrandTheme,
  type Address,
  type CurrencyCode,
  type Retailer,
  type RetailerId,
  type RetailerBrandTheme,
  type RetailerBrandThemeVersion,
  type RetailerTier,
} from "@paon/domain";
import type { PostgrestError } from "@supabase/supabase-js";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type RetailerRow = Database["public"]["Tables"]["retailers"]["Row"];
type ThemeVersionRow =
  Database["public"]["Tables"]["retailer_brand_theme_versions"]["Row"];

const UNIQUE_VIOLATION = "23505";

export class SlugAlreadyExistsError extends Error {
  constructor(public readonly slug: string) {
    super(`A retailer with slug "${slug}" already exists.`);
    this.name = "SlugAlreadyExistsError";
  }
}

function isUniqueViolation(error: PostgrestError): boolean {
  return error.code === UNIQUE_VIOLATION;
}

function toDomain(row: RetailerRow): Retailer {
  return {
    id: asId<"RetailerId">(row.id),
    legalName: row.legal_name,
    displayName: row.display_name,
    slug: row.slug,
    status: row.status,
    tier: row.tier,
    ...(row.primary_domain ? { primaryDomain: row.primary_domain } : {}),
    billingAddress: row.billing_address as unknown as Address,
    defaultCurrency: row.default_currency,
    defaultLocale: row.default_locale,
    brandTheme: normalizeRetailerBrandTheme(row.brand_theme),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function themeVersionToDomain(row: ThemeVersionRow): RetailerBrandThemeVersion {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    versionNumber: row.version_number,
    theme: normalizeRetailerBrandTheme(row.theme),
    changeNote: row.change_note,
    ...(row.changed_by_user_id
      ? { changedByUserId: row.changed_by_user_id }
      : {}),
    createdAt: row.created_at,
  };
}

export interface CreateRetailerParams {
  legalName: string;
  displayName: string;
  slug: string;
  tier: RetailerTier;
  defaultCurrency: CurrencyCode;
  defaultLocale: string;
  billingAddress: Address;
}

/**
 * Business-profile fields only — `slug`, `tier`, `status` and
 * `defaultCurrency` stay platform-controlled and are never accepted
 * here. See docs/DECISIONS.md ADR-012.
 */
export interface UpdateRetailerProfileParams {
  legalName: string;
  displayName: string;
  primaryDomain?: string;
  defaultLocale: string;
  billingAddress: Address;
}

/**
 * Reference implementation of the repository pattern every domain
 * aggregate follows: one repository per aggregate root, constructed
 * with an already-authenticated Supabase client (never a bare URL/key),
 * translating between `Database["public"]["Tables"]` rows and
 * `@paon/domain` entities. See ARCHITECTURE.md "Data Access Layer".
 */
export class RetailerRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

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

  async list(): Promise<Retailer[]> {
    const { data, error } = await this.client
      .from("retailers")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async create(params: CreateRetailerParams): Promise<Retailer> {
    const { data, error } = await this.client
      .from("retailers")
      .insert({
        legal_name: params.legalName,
        display_name: params.displayName,
        slug: params.slug,
        tier: params.tier,
        default_currency: params.defaultCurrency,
        default_locale: params.defaultLocale,
        billing_address: params.billingAddress as unknown as Json,
      })
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        throw new SlugAlreadyExistsError(params.slug);
      }
      throw error;
    }

    return toDomain(data);
  }

  /**
   * Retailer-staff-facing update — the `retailers` table's `update`
   * RLS policy plus `enforce_retailer_staff_editable_columns_on_update`
   * trigger reject any attempt to reach `slug`/`tier`/`status`/
   * `defaultCurrency` through this path even if a caller passed them,
   * so this method's params shape is the only real guard needed here.
   */
  async updateProfile(
    id: RetailerId,
    params: UpdateRetailerProfileParams,
  ): Promise<Retailer> {
    const { data, error } = await this.client
      .from("retailers")
      .update({
        legal_name: params.legalName,
        display_name: params.displayName,
        primary_domain: params.primaryDomain ?? null,
        default_locale: params.defaultLocale,
        billing_address: params.billingAddress as unknown as Json,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return toDomain(data);
  }

  async saveBrandTheme(
    id: RetailerId,
    theme: RetailerBrandTheme,
    changeNote: string,
  ): Promise<number> {
    const { data, error } = await this.client.rpc("save_retailer_brand_theme", {
      p_retailer_id: id,
      p_theme: theme as unknown as Json,
      p_change_note: changeNote,
    });
    if (error) throw error;
    return data;
  }

  async listBrandThemeVersions(
    id: RetailerId,
  ): Promise<RetailerBrandThemeVersion[]> {
    const { data, error } = await this.client
      .from("retailer_brand_theme_versions")
      .select("*")
      .eq("retailer_id", id)
      .order("version_number", { ascending: false });
    if (error) throw error;
    return data.map(themeVersionToDomain);
  }

  async restoreBrandTheme(
    id: RetailerId,
    versionNumber: number,
  ): Promise<number> {
    const { data, error } = await this.client.rpc(
      "restore_retailer_brand_theme",
      {
        p_retailer_id: id,
        p_version_number: versionNumber,
      },
    );
    if (error) throw error;
    return data;
  }
}
