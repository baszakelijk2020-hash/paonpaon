/**
 * Retailer branch persistence (CLI-006 / PHASE 7.5).
 */

import {
  asId,
  isSupportedTimeZone,
  type BranchContactAction,
  type BranchImage,
  type BranchOpeningHoursEntry,
  type BranchPresentationMode,
  type RetailerBranch,
  type RetailerBranchId,
  type RetailerId,
  type UpdateRetailerBranchLocationInput,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type Row = Database["public"]["Tables"]["retailer_branches"]["Row"];

function toDomain(row: Row): RetailerBranch {
  return {
    id: asId<"RetailerBranchId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    name: row.name,
    timezone: row.timezone,
    isDefault: row.is_default,
    storeType: row.store_type,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    region: row.region,
    postalCode: row.postal_code,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    contactEmail: row.contact_email,
    openingHours: (row.opening_hours ??
      []) as unknown as readonly BranchOpeningHoursEntry[],
    services: row.services ?? [],
    contactActions: (row.contact_actions ??
      []) as unknown as readonly BranchContactAction[],
    filterCategories: row.filter_categories ?? [],
    imagery: (row.imagery ?? []) as unknown as readonly BranchImage[],
    presentationMode: row.presentation_mode as BranchPresentationMode,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class RetailerBranchRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listByRetailer(retailerId: RetailerId): Promise<RetailerBranch[]> {
    const { data, error } = await this.client
      .from("retailer_branches")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw error;
    return data.map(toDomain);
  }

  async findDefault(retailerId: RetailerId): Promise<RetailerBranch | null> {
    const branches = await this.listByRetailer(retailerId);
    return branches.find((branch) => branch.isDefault) ?? branches[0] ?? null;
  }

  async ensureDefaultBranch(args: {
    readonly retailerId: RetailerId;
    readonly name?: string;
    readonly timezone?: string;
  }): Promise<RetailerBranch> {
    const existing = await this.findDefault(args.retailerId);
    if (existing) return existing;

    const timezone = args.timezone ?? "UTC";
    if (!isSupportedTimeZone(timezone)) {
      throw new Error(`Unsupported timezone: ${timezone}`);
    }

    const { data, error } = await this.client
      .from("retailer_branches")
      .insert({
        retailer_id: args.retailerId,
        name: args.name ?? "Main house",
        timezone,
        is_default: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }

  async create(args: {
    readonly retailerId: RetailerId;
    readonly name: string;
    readonly timezone: string;
    readonly isDefault?: boolean;
  }): Promise<RetailerBranch> {
    if (!isSupportedTimeZone(args.timezone)) {
      throw new Error(`Unsupported timezone: ${args.timezone}`);
    }
    const { data, error } = await this.client
      .from("retailer_branches")
      .insert({
        retailer_id: args.retailerId,
        name: args.name.trim(),
        timezone: args.timezone,
        is_default: args.isDefault ?? false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }

  async findById(
    retailerId: RetailerId,
    branchId: RetailerBranchId,
  ): Promise<RetailerBranch | null> {
    const { data, error } = await this.client
      .from("retailer_branches")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("id", branchId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  /** FT-11: retailer staff editing a branch's public location facts. */
  async updateLocationDetails(
    retailerId: RetailerId,
    input: UpdateRetailerBranchLocationInput,
  ): Promise<RetailerBranch> {
    const { data, error } = await this.client
      .from("retailer_branches")
      .update({
        store_type: input.storeType ?? null,
        address_line1: input.addressLine1 ?? null,
        address_line2: input.addressLine2 ?? null,
        city: input.city ?? null,
        region: input.region ?? null,
        postal_code: input.postalCode ?? null,
        country: input.country ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        phone: input.phone ?? null,
        contact_email: input.contactEmail ?? null,
        opening_hours: input.openingHours,
        services: input.services,
        contact_actions: input.contactActions,
        filter_categories: input.filterCategories,
        imagery: input.imagery,
        presentation_mode: input.presentationMode,
        published: input.published,
      })
      .eq("retailer_id", retailerId)
      .eq("id", input.branchId)
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }

  /**
   * FT-11 public projection: published, non-deleted branches only — the
   * query itself is the trust boundary the customer-facing finder relies
   * on (see the `anyone can read published branches from active
   * retailers` RLS policy this mirrors).
   */
  async findPublishedByRetailer(
    retailerId: RetailerId,
  ): Promise<RetailerBranch[]> {
    const { data, error } = await this.client
      .from("retailer_branches")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("published", true)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw error;
    return data.map(toDomain);
  }
}
