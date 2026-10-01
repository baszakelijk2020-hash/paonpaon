"use server";

import {
  OrderRepository,
  RetailerRepository,
  WishlistRepository,
} from "@paon/database";
import {
  placeOrderInputSchema,
  toggleWishlistItemInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertRetailerModuleActive } from "@/lib/module-session";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Same shape and same failure discipline as the storefront's own
 * product-detail actions (`r/[slug]/products/[productSlug]/actions.ts`):
 * validation and module/repository failures come back as a form error the
 * caller renders inline. Throwing instead would unmount the whole Appointments
 * page into an error boundary over something as ordinary as a retailer having
 * switched a module off.
 */
export interface AppointmentProductFormState {
  formError?: string;
}

export async function toggleAppointmentProductFavorite(
  _prevState: AppointmentProductFormState,
  formData: FormData,
): Promise<AppointmentProductFormState> {
  // Outside the try/catch below — requireSession() redirects by throwing, and
  // that throw must reach Next rather than become a form error.
  await requireSession();

  const parsed = toggleWishlistItemInputSchema.safeParse({
    retailerId: formData.get("retailerId"),
    productVariantId: formData.get("productVariantId"),
  });
  if (!parsed.success) {
    return { formError: "Choose a valid option." };
  }

  const supabase = await getSupabaseServerClient();
  try {
    await assertRetailerModuleActive(
      supabase,
      parsed.data.retailerId as never,
      "wardrobe_styling",
    );
    await new WishlistRepository(supabase).toggleItem(
      parsed.data.retailerId as never,
      parsed.data.productVariantId as never,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  revalidatePath("/appointments");
  revalidatePath("/wishlist");
  return {};
}

export async function addAppointmentProductToBag(
  _prevState: AppointmentProductFormState,
  formData: FormData,
): Promise<AppointmentProductFormState> {
  await requireSession();

  const parsed = placeOrderInputSchema.safeParse({
    retailerId: formData.get("retailerId"),
    productVariantId: formData.get("productVariantId"),
    quantity: "1",
  });
  if (!parsed.success) {
    return { formError: "Choose a valid option." };
  }

  const supabase = await getSupabaseServerClient();
  let cartHref = "/appointments";
  try {
    await assertRetailerModuleActive(
      supabase,
      parsed.data.retailerId as never,
      "commerce_growth",
      "mutate",
      "This shop isn't accepting orders right now. Please check back soon.",
    );
    await new OrderRepository(supabase).addToCart({
      retailerId: parsed.data.retailerId as never,
      productVariantId: parsed.data.productVariantId,
      quantity: 1,
    });
    const retailer = await new RetailerRepository(supabase).findById(
      parsed.data.retailerId as never,
    );
    if (retailer) cartHref = `/r/${retailer.slug}/cart`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  // Outside the try/catch — redirect() throws internally, and that throw must
  // not be caught and turned into a form error.
  redirect(cartHref);
}
