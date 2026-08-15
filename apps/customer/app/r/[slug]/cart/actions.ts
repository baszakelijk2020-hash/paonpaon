"use server";

import { OrderRepository, RetailerRepository } from "@paon/database";
import {
  asId,
  checkoutCartInputSchema,
  updateCartLineInputSchema,
} from "@paon/domain";
import type { RetailerId } from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertCartLineBelongsToRetailer } from "@/lib/cart-ownership";
import { assertRetailerModuleActive } from "@/lib/module-session";
import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function requireCommerceModule(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  slug: string,
): Promise<RetailerId> {
  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer) throw new Error("Retailer not found");
  await assertRetailerModuleActive(
    supabase,
    retailer.id,
    "commerce_growth",
    "mutate",
    "This shop isn't accepting orders right now. Please check back soon.",
  );
  return retailer.id;
}

export interface CartFormState {
  formError?: string;
}

export async function updateCartLine(
  slug: string,
  _previous: CartFormState,
  formData: FormData,
): Promise<CartFormState> {
  const session = await getSession();
  if (!session || session.accountType !== "customer")
    redirect(`/login?redirectTo=/r/${slug}/cart`);
  const parsed = updateCartLineInputSchema.safeParse({
    lineId: formData.get("lineId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success)
    return { formError: "Choose a quantity between 0 and 20." };
  try {
    const supabase = await getSupabaseServerClient();
    const retailerId = await requireCommerceModule(supabase, slug);
    await assertCartLineBelongsToRetailer(
      supabase,
      retailerId,
      session.userId,
      parsed.data.lineId,
    );
    await new OrderRepository(supabase).updateCartLine(
      parsed.data.lineId,
      parsed.data.quantity,
    );
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Cart update failed",
    };
  }
  revalidatePath(`/r/${slug}/cart`);
  return {};
}

export async function checkoutCart(
  slug: string,
  _previous: CartFormState,
  formData: FormData,
): Promise<CartFormState> {
  const session = await getSession();
  if (!session || session.accountType !== "customer")
    redirect(`/login?redirectTo=/r/${slug}/cart`);
  const parsed = checkoutCartInputSchema.safeParse({
    orderId: formData.get("orderId"),
    shippingAddress: {
      line1: formData.get("line1"),
      line2: formData.get("line2") || undefined,
      city: formData.get("city"),
      region: formData.get("region") || undefined,
      postalCode: formData.get("postalCode"),
      countryCode: formData.get("countryCode"),
    },
  });
  if (!parsed.success)
    return { formError: "Complete a valid shipping address." };
  let orderId: string;
  try {
    const supabase = await getSupabaseServerClient();
    await requireCommerceModule(supabase, slug);
    orderId = await new OrderRepository(supabase).checkoutCart(
      asId<"OrderId">(parsed.data.orderId),
      {
        line1: parsed.data.shippingAddress.line1,
        city: parsed.data.shippingAddress.city,
        postalCode: parsed.data.shippingAddress.postalCode,
        countryCode: parsed.data.shippingAddress.countryCode,
        ...(parsed.data.shippingAddress.line2
          ? { line2: parsed.data.shippingAddress.line2 }
          : {}),
        ...(parsed.data.shippingAddress.region
          ? { region: parsed.data.shippingAddress.region }
          : {}),
      },
    );
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Checkout failed",
    };
  }
  redirect(`/orders/${orderId}`);
}
