"use server";

import {
  CustomerRepository,
  ProductVariantRepository,
  WishlistRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface TrayActionResult {
  readonly error?: string;
}

async function resolveCustomer(retailerId: string) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find((row) => row.retailerId === retailerId);
  if (!customer) throw new Error("Customer relationship not found.");
  return { customer, supabase };
}

/** Saves a catalogue piece to the customer's favorites (the wishlist), which
 * is what the fitting-room tray lists. Idempotent — a replayed tap cannot
 * remove the piece. */
export async function saveProductToFittingRoom(
  retailerId: string,
  variantId: string,
): Promise<TrayActionResult> {
  // Outside the try: requireSession redirects by throwing, and the catch
  // would turn that redirect into an error message.
  await requireSession();
  try {
    const { customer, supabase } = await resolveCustomer(retailerId);
    await new WishlistRepository(supabase).saveItem(
      customer.retailerId,
      asId<"ProductVariantId">(variantId),
    );
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save piece.",
    };
  }
  revalidatePath("/wardrobe");
  revalidatePath("/digital-fitting-room");
  return {};
}

/** Removes every saved variant of a catalogue piece from the favorites. */
export async function removeProductFromFittingRoom(
  retailerId: string,
  productId: string,
): Promise<TrayActionResult> {
  // Outside the try: requireSession redirects by throwing, and the catch
  // would turn that redirect into an error message.
  await requireSession();
  try {
    const { customer, supabase } = await resolveCustomer(retailerId);
    const wishlistRepo = new WishlistRepository(supabase);
    const variantRepo = new ProductVariantRepository(supabase);
    const wishlist = await wishlistRepo.findByCustomer(customer.id);
    if (wishlist) {
      const items = await wishlistRepo.findItems(wishlist.id);
      for (const item of items) {
        const variant = await variantRepo.findById(item.productVariantId);
        if (variant?.productId === productId) {
          // toggleItem removes an item that is present.
          await wishlistRepo.toggleItem(
            customer.retailerId,
            item.productVariantId,
          );
        }
      }
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not remove piece.",
    };
  }
  revalidatePath("/wardrobe");
  revalidatePath("/digital-fitting-room");
  return {};
}
