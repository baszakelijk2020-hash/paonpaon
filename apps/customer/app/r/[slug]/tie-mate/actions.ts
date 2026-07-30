"use server";

import { WishlistRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { captureSignedInInteractionEvent } from "@/lib/capture-interaction-event";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/** Save the current fabric to the wishlist (Tie-Mate swipe-right / Save). */
export async function saveTieMateFabric(args: {
  readonly retailerId: string;
  readonly slug: string;
  readonly productVariantId: string;
  readonly productId: string;
  readonly sessionId?: string;
}): Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: string }
> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(args.retailerId);

  try {
    await new WishlistRepository(supabase).toggleItem(
      rId,
      asId<"ProductVariantId">(args.productVariantId),
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save fabric",
    };
  }

  const idempotencyKey = args.sessionId
    ? `${args.sessionId}:tie_mate_save:${args.productVariantId}`
    : `tie_mate_save:${args.productVariantId}:${Date.now()}`;

  await captureSignedInInteractionEvent({
    retailerId: args.retailerId,
    name: "product_favorited",
    idempotencyKey,
    properties: {
      productId: args.productId,
      productVariantId: args.productVariantId,
      via: "tie_mate",
    },
    ...(args.sessionId ? { sessionId: args.sessionId } : {}),
  });

  revalidatePath(`/r/${args.slug}/tie-mate`);
  revalidatePath("/wishlist");
  return { ok: true };
}

/** Skip the current fabric (Tie-Mate swipe-left). Consented signal only. */
export async function skipTieMateFabric(args: {
  readonly retailerId: string;
  readonly productId: string;
  readonly sessionId?: string;
}): Promise<void> {
  await requireSession();
  const idempotencyKey = args.sessionId
    ? `${args.sessionId}:tie_mate_skip:${args.productId}`
    : `tie_mate_skip:${args.productId}:${Date.now()}`;

  await captureSignedInInteractionEvent({
    retailerId: args.retailerId,
    name: "product_skipped",
    idempotencyKey,
    properties: { productId: args.productId, via: "tie_mate" },
    ...(args.sessionId ? { sessionId: args.sessionId } : {}),
  });
}
