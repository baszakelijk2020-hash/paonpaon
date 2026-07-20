"use server";

import { AnalyticsRepository, WishlistRepository } from "@paon/database";
import { asId } from "@paon/domain";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/** A swipe-right: saves the variant (idempotent — the deck already
 * knows which variants are saved and never calls this twice for the
 * same one) and logs it as `product_favorited`, feeding Self-Portrait
 * (ADR-034/035) exactly like a wishlist-page save would. */
export async function swipeRight(
  retailerId: string,
  productVariantId: string,
  productId: string,
): Promise<void> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);

  await new WishlistRepository(supabase).toggleItem(
    rId,
    asId<"ProductVariantId">(productVariantId),
  );

  try {
    await new AnalyticsRepository(supabase).capture({
      retailerId: rId,
      name: "product_favorited",
      properties: { productId, productVariantId, via: "swipe" },
      occurredAt: new Date().toISOString(),
      source: "customer_portal",
    });
  } catch {
    // Best-effort — a failed capture must never block the save.
  }
}

/** A swipe-left: no persisted state, just a signal for future
 * personalisation — logged the same best-effort way as swipeRight. */
export async function swipeLeft(
  retailerId: string,
  productId: string,
): Promise<void> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  try {
    await new AnalyticsRepository(supabase).capture({
      retailerId: asId<"RetailerId">(retailerId),
      name: "product_skipped",
      properties: { productId, via: "swipe" },
      occurredAt: new Date().toISOString(),
      source: "customer_portal",
    });
  } catch {
    // Best-effort.
  }
}
