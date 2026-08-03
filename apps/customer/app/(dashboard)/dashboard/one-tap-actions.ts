"use server";

import { CustomerRepository, OrderRepository } from "@paon/database";
import { addressSchema, asId } from "@paon/domain";
import { stripUndefined } from "@paon/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

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

export interface SaveAddressState {
  formError?: string;
}

/**
 * "Turn on 1-Tap Checkout" — the whole eligibility requirement is a saved
 * default address, since the real checkout RPC (`checkout_cart`) has never
 * collected payment at all; it leaves a new order at `pending_payment`
 * regardless of how many manual steps created it. This does not add or
 * imply a payment method — that stays gated on a real processor decision.
 */
export async function saveDefaultShippingAddress(
  retailerId: string,
  _prevState: SaveAddressState,
  formData: FormData,
): Promise<SaveAddressState> {
  const parsed = addressSchema.safeParse({
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    city: formData.get("city"),
    region: formData.get("region") || undefined,
    postalCode: formData.get("postalCode"),
    countryCode: formData.get("countryCode"),
  });
  if (!parsed.success) {
    return {
      formError: parsed.error.issues[0]?.message ?? "Enter a valid address.",
    };
  }

  try {
    const { customer, supabase } = await resolveCustomer(retailerId);
    await new CustomerRepository(supabase).updateMyDefaultShippingAddress(
      asId<"RetailerId">(customer.retailerId),
      stripUndefined(parsed.data),
    );
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not save address.",
    };
  }

  revalidatePath("/dashboard");
  return {};
}

/**
 * One-tap buy: add the variant to cart and check out immediately with the
 * saved default address — the exact same `add_to_cart` / `checkout_cart`
 * RPCs the manual storefront flow uses, just chained without the manual
 * address form in between. Creates a real order at `pending_payment`,
 * same as every other order; no payment is captured here or anywhere else
 * in this checkout path today.
 */
export async function oneTapBuy(
  retailerId: string,
  productVariantId: string,
): Promise<void> {
  const { customer, supabase } = await resolveCustomer(retailerId);
  const address = customer.shippingAddresses[0];
  if (!address) {
    throw new Error("Turn on 1-Tap Checkout first — no saved address.");
  }

  const orderRepo = new OrderRepository(supabase);
  const orderId = await orderRepo.addToCart({
    retailerId: asId<"RetailerId">(retailerId),
    productVariantId,
    quantity: 1,
  });
  const finalOrderId = await orderRepo.checkoutCart(orderId, address);
  revalidatePath("/dashboard");
  redirect(`/orders/${finalOrderId}`);
}
