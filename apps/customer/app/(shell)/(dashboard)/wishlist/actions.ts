"use server";

import { WishlistRepository } from "@paon/database";
import { toggleWishlistItemInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function removeFromWishlist(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = toggleWishlistItemInputSchema.parse({
    retailerId: formData.get("retailerId"),
    productVariantId: formData.get("productVariantId"),
  });
  await new WishlistRepository(await getSupabaseServerClient()).toggleItem(
    parsed.retailerId as never,
    parsed.productVariantId as never,
  );
  revalidatePath("/wishlist");
}

/**
 * Folds favorites a guest saved to `localStorage` on the HTML storefront
 * (`paon-favorites:{slug}`, product-slug ids only — no server record for
 * a signed-out visitor) into the real `Wishlist` once they sign in.
 * `toggleItem` is the one write path (ADR-026's `toggle_wishlist_item`
 * RPC) and is inherently a toggle, so a variant already saved before this
 * merge runs would otherwise be removed by it — the immediate re-toggle
 * below is what keeps this idempotent rather than a second RPC.
 */
export async function mergeLocalFavorites(
  retailerId: string,
  variantIds: string[],
): Promise<void> {
  await requireSession();
  if (variantIds.length === 0) return;
  const parsedRetailerId =
    toggleWishlistItemInputSchema.shape.retailerId.parse(retailerId);
  const repo = new WishlistRepository(await getSupabaseServerClient());
  for (const rawVariantId of variantIds) {
    const variantId =
      toggleWishlistItemInputSchema.shape.productVariantId.parse(rawVariantId);
    const nowSaved = await repo.toggleItem(
      parsedRetailerId as never,
      variantId as never,
    );
    if (!nowSaved) {
      // Was already saved before the merge ran — restore it.
      await repo.toggleItem(parsedRetailerId as never, variantId as never);
    }
  }
  revalidatePath("/wishlist");
  revalidatePath("/dashboard");
}
