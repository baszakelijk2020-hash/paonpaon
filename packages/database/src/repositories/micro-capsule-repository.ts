import {
  asId,
  type CreateMicroCapsuleDropInput,
  type MicroCapsuleDrop,
  type MicroCapsuleDropProduct,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type DropRow = Database["public"]["Tables"]["micro_capsule_drops"]["Row"];
type DropProductRow =
  Database["public"]["Tables"]["micro_capsule_drop_products"]["Row"];

function toDrop(row: DropRow): MicroCapsuleDrop {
  return {
    id: asId<"MicroCapsuleDropId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    title: row.title,
    ...(row.theme ? { theme: row.theme } : {}),
    weekStart: row.week_start,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toDropProduct(row: DropProductRow): MicroCapsuleDropProduct {
  return {
    id: asId<"MicroCapsuleDropProductId">(row.id),
    dropId: asId<"MicroCapsuleDropId">(row.drop_id),
    productId: asId<"ProductId">(row.product_id),
    rank: row.rank,
  };
}

/** Weekly micro-capsule drops — see docs/DOMAIN_MODEL.md "Catalog" and 20260803000005. */
export class MicroCapsuleRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByRetailer(retailerId: RetailerId): Promise<MicroCapsuleDrop[]> {
    const { data, error } = await this.client
      .from("micro_capsule_drops")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("week_start", { ascending: false });
    if (error) throw error;
    return data.map(toDrop);
  }

  async findById(dropId: string): Promise<MicroCapsuleDrop | null> {
    const { data, error } = await this.client
      .from("micro_capsule_drops")
      .select("*")
      .eq("id", dropId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toDrop(data) : null;
  }

  /** The most recent published drop whose week has started — the customer-facing "this week's capsule". */
  async findCurrentPublished(
    retailerId: RetailerId,
  ): Promise<MicroCapsuleDrop | null> {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.client
      .from("micro_capsule_drops")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("published", true)
      .is("deleted_at", null)
      .lte("week_start", today)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toDrop(data) : null;
  }

  async findProductsForDrop(
    dropId: string,
  ): Promise<MicroCapsuleDropProduct[]> {
    const { data, error } = await this.client
      .from("micro_capsule_drop_products")
      .select("*")
      .eq("drop_id", dropId)
      .order("rank", { ascending: true });
    if (error) throw error;
    return data.map(toDropProduct);
  }

  async createDrop(
    retailerId: RetailerId,
    input: CreateMicroCapsuleDropInput,
  ): Promise<MicroCapsuleDrop> {
    const { data, error } = await this.client
      .from("micro_capsule_drops")
      .insert({
        retailer_id: retailerId,
        title: input.title,
        theme: input.theme ?? null,
        week_start: input.weekStart,
      })
      .select("*")
      .single();
    if (error) throw error;
    const drop = toDrop(data);

    const { error: productsError } = await this.client
      .from("micro_capsule_drop_products")
      .insert(
        input.productIds.map((productId, index) => ({
          drop_id: drop.id,
          product_id: productId,
          rank: index + 1,
        })),
      );
    if (productsError) throw productsError;

    return drop;
  }

  async setPublished(dropId: string, published: boolean): Promise<void> {
    const { error } = await this.client
      .from("micro_capsule_drops")
      .update({ published })
      .eq("id", dropId);
    if (error) throw error;
  }
}
