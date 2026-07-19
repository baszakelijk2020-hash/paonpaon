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
