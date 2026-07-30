import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";
import { WishlistRepository } from "./wishlist-repository";

type WishlistRow = Database["public"]["Tables"]["wishlists"]["Row"];
type WishlistItemRow = Database["public"]["Tables"]["wishlist_items"]["Row"];

const wishlistRow: WishlistRow = {
  id: "77777777-7777-7777-7777-777777777777",
  customer_id: "44444444-4444-4444-4444-444444444444",
  name: "Wishlist",
  is_default: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

const wishlistItemRow: WishlistItemRow = {
  wishlist_id: wishlistRow.id,
  product_variant_id: "88888888-8888-8888-8888-888888888888",
  added_at: "2026-01-01T00:00:00.000Z",
  note: null,
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("WishlistRepository", () => {
  it("maps a row to a domain Wishlist", async () => {
    const repo = new WishlistRepository(
      clientReturning({ data: wishlistRow, error: null }),
    );
    const wishlist = await repo.findByCustomer(
      wishlistRow.customer_id as never,
    );
    expect(wishlist?.isDefault).toBe(true);
    expect(wishlist?.name).toBe("Wishlist");
  });

  it("returns null when the customer has no wishlist yet", async () => {
    const repo = new WishlistRepository(
      clientReturning({ data: null, error: null }),
    );
    expect(await repo.findByCustomer("nonexistent" as never)).toBeNull();
  });

  it("maps wishlist items", async () => {
    const repo = new WishlistRepository(
      clientReturning({ data: [wishlistItemRow], error: null }),
    );
    const items = await repo.findItems(wishlistRow.id as never);
    expect(items).toHaveLength(1);
    expect(items[0]?.productVariantId).toBe(wishlistItemRow.product_variant_id);
    expect(items[0]?.note).toBeUndefined();
  });

  it("toggleItem calls the protected RPC and returns whether the item is now saved", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const repo = new WishlistRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    const saved = await repo.toggleItem(
      "11111111-1111-1111-1111-111111111111" as never,
      wishlistItemRow.product_variant_id as never,
    );

    expect(rpc).toHaveBeenCalledWith("toggle_wishlist_item", {
      p_retailer_id: "11111111-1111-1111-1111-111111111111",
      p_variant_id: wishlistItemRow.product_variant_id,
    });
    expect(saved).toBe(true);
  });

  it("surfaces cross-retailer wishlist denial from toggle_wishlist_item", async () => {
    // Tie-Mate save delegates to this RPC. A variant that does not belong to
    // the requested retailer must fail closed (same message as the SQL guard).
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Product is not available from this retailer" },
    });
    const repo = new WishlistRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await expect(
      repo.toggleItem(
        "11111111-1111-1111-1111-111111111111" as never,
        "99999999-9999-4999-8999-999999999999" as never,
      ),
    ).rejects.toMatchObject({
      message: "Product is not available from this retailer",
    });

    expect(rpc).toHaveBeenCalledWith("toggle_wishlist_item", {
      p_retailer_id: "11111111-1111-1111-1111-111111111111",
      p_variant_id: "99999999-9999-4999-8999-999999999999",
    });
  });
});
