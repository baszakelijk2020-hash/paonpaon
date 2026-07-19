"use server";

import { OrderRepository } from "@paon/database";
import { placeOrderInputSchema } from "@paon/domain";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface PlaceOrderFormState {
  formError?: string;
}

export const initialPlaceOrderFormState: PlaceOrderFormState = {};

export async function placeOrder(
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

  let orderId: string;
  try {
    orderId = await new OrderRepository(supabase).placeOrder({
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
  redirect(`/orders/${orderId}`);
}
