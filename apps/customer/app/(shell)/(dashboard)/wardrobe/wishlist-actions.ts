"use server";

import { CustomerRepository, WishlistRepository } from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface WishlistActionState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

async function resolveCustomer(userId: string, retailerId: string) {
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    userId as never,
  );
  return customers.find((candidate) => candidate.retailerId === retailerId);
}

/**
 * Toggle a product variant in the customer's wishlist. If the item exists,
 * remove it; otherwise add it. The wishlist is automatically created if needed
 * by the backend RPC.
 */
export async function toggleWishlistItem(
  _prevState: WishlistActionState,
  formData: FormData,
): Promise<WishlistActionState> {
  const session = await requireSession();
  const retailerId = formData.get("retailerId");
  const productVariantId = formData.get("productVariantId");

  if (
    typeof retailerId !== "string" ||
    typeof productVariantId !== "string" ||
    !retailerId ||
    !productVariantId
  ) {
    return {
      fieldErrors: {},
      formError: "Invalid request parameters.",
    };
  }

  try {
    const customer = await resolveCustomer(session.userId, retailerId);
    if (!customer) {
      return {
        fieldErrors: {},
        formError: "Customer relationship not found.",
      };
    }

    const supabase = await getSupabaseServerClient();
    const wishlistRepo = new WishlistRepository(supabase);

    // toggleItem handles wishlist creation automatically
    await wishlistRepo.toggleItem(
      retailerId as never,
      productVariantId as never,
    );
    revalidatePath("/wardrobe");
    return { fieldErrors: {}, success: true };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not update wishlist.",
    };
  }
}
