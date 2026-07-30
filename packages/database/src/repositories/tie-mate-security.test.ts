import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { WishlistRepository } from "./wishlist-repository";

/**
 * Tie-Mate mutations reuse `toggle_wishlist_item`. These tests prove the
 * repository path Tie-Mate save uses — authenticated RPC args plus
 * fail-closed propagation of cross-retailer denial — without pretending
 * migration-string checks are runtime RLS or browser coverage.
 */
describe("Tie-Mate wishlist mutation security path", () => {
  it("passes the authenticated retailer and variant into toggle_wishlist_item", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const repo = new WishlistRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    const retailerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const variantId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    await expect(
      repo.toggleItem(retailerId as never, variantId as never),
    ).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("toggle_wishlist_item", {
      p_retailer_id: retailerId,
      p_variant_id: variantId,
    });
  });

  it("denies a cross-retailer variant/wishlist mutation", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Product is not available from this retailer" },
    });
    const repo = new WishlistRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await expect(
      repo.toggleItem(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as never,
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc" as never,
      ),
    ).rejects.toMatchObject({
      message: "Product is not available from this retailer",
    });
  });
});
