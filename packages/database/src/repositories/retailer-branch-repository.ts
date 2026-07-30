/**
 * Retailer branch persistence (CLI-006 / PHASE 7.5).
 */

import {
  asId,
  isSupportedTimeZone,
  type RetailerBranch,
  type RetailerBranchId,
  type RetailerId,
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
}
