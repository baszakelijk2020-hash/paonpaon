import {
  asId,
  type CustomerId,
  type ProductVariantId,
  type RetailerId,
  type Wishlist,
  type WishlistId,
  type WishlistItem,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type WishlistRow = Database["public"]["Tables"]["wishlists"]["Row"];
type WishlistItemRow = Database["public"]["Tables"]["wishlist_items"]["Row"];

function toDomain(row: WishlistRow): Wishlist {
  return {
    id: asId<"WishlistId">(row.id),
    customerId: asId<"CustomerId">(row.customer_id),
    name: row.name,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function itemToDomain(row: WishlistItemRow): WishlistItem {
  return {
    wishlistId: asId<"WishlistId">(row.wishlist_id),
    productVariantId: asId<"ProductVariantId">(row.product_variant_id),
    addedAt: row.added_at,
    ...(row.note ? { note: row.note } : {}),
  };
}

export class WishlistRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByCustomer(customerId: CustomerId): Promise<Wishlist | null> {
    const { data, error } = await this.client
      .from("wishlists")
      .select("*")
      .eq("customer_id", customerId)
      .eq("is_default", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async findItems(wishlistId: WishlistId): Promise<WishlistItem[]> {
    const { data, error } = await this.client
      .from("wishlist_items")
      .select("*")
      .eq("wishlist_id", wishlistId)
      .order("added_at", { ascending: false });
    if (error) throw error;
    return data.map(itemToDomain);
  }

  /** Returns true if the variant is now saved, false if it was just removed. */
  async toggleItem(
    retailerId: RetailerId,
    productVariantId: ProductVariantId,
  ): Promise<boolean> {
    const { data, error } = await this.client.rpc("toggle_wishlist_item", {
      p_retailer_id: retailerId,
      p_variant_id: productVariantId,
    });
    if (error) throw error;
    return data;
  }
}
