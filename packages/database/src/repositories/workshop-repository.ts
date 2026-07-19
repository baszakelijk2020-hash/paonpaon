import {
  asId,
  type Address,
  type RetailerId,
  type Workshop,
  type WorkshopId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type WorkshopRow = Database["public"]["Tables"]["workshops"]["Row"];

function toDomain(row: WorkshopRow): Workshop {
  return {
    id: asId<"WorkshopId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    name: row.name,
    status: row.status,
    ...(row.email ? { email: row.email } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.address ? { address: row.address as unknown as Address } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class WorkshopRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByRetailer(retailerId: RetailerId): Promise<Workshop[]> {
    const { data, error } = await this.client
      .from("workshops")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) throw error;
    return data.map(toDomain);
  }

  async create(params: {
    retailerId: RetailerId;
    name: string;
    email?: string;
    phone?: string;
  }): Promise<Workshop> {
    const { data, error } = await this.client
      .from("workshops")
      .insert({
        retailer_id: params.retailerId,
        name: params.name,
        email: params.email ?? null,
        phone: params.phone ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }

  async findById(id: WorkshopId): Promise<Workshop | null> {
    const { data, error } = await this.client
      .from("workshops")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }
}
