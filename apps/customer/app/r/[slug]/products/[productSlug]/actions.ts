"use server";

import { OrderRepository, WishlistRepository } from "@paon/database";
import {
  placeOrderInputSchema,
  toggleWishlistItemInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface PlaceOrderFormState {
  formError?: string;
}

export interface ToggleWishlistState {
  formError?: string;
}

export async function addToCart(
  slug: string,
  productSlug: string,
  _prevState: PlaceOrderFormState,
  formData: FormData,
): Promise<PlaceOrderFormState> {
  const session = await getSession();
  if (!session || session.accountType !== "customer") {
    redirect(`/login?redirectTo=/r/${slug}/products/${productSlug}`);
  }

  const parsed = placeOrderInputSchema.safeParse({
    retailerId: formData.get("retailerId"),
    productVariantId: formData.get("productVariantId"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    return { formError: "Choose a valid option and quantity." };
  }

  const supabase = await getSupabaseServerClient();

  try {
    await new OrderRepository(supabase).addToCart({
      retailerId: parsed.data.retailerId as never,
      productVariantId: parsed.data.productVariantId,
      quantity: parsed.data.quantity,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  // Outside the try/catch — redirect() throws internally, and that
  // throw must not be caught and turned into a form error.
  redirect(`/r/${slug}/cart`);
}

export async function toggleWishlist(
  slug: string,
  productSlug: string,
  _prevState: ToggleWishlistState,
  formData: FormData,
): Promise<ToggleWishlistState> {
  const session = await getSession();
  if (!session || session.accountType !== "customer") {
    redirect(`/login?redirectTo=/r/${slug}/products/${productSlug}`);
  }

  const parsed = toggleWishlistItemInputSchema.safeParse({
    retailerId: formData.get("retailerId"),
    productVariantId: formData.get("productVariantId"),
  });
  if (!parsed.success) {
    return { formError: "Choose a valid option." };
  }

  const supabase = await getSupabaseServerClient();
  try {
    await new WishlistRepository(supabase).toggleItem(
      parsed.data.retailerId as never,
      parsed.data.productVariantId as never,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update wishlist";
    return { formError: message };
  }

  revalidatePath(`/r/${slug}/products/${productSlug}`);
  return {};
}
