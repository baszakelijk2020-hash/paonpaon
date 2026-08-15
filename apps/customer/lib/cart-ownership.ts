import { CustomerRepository, OrderRepository } from "@paon/database";
import type { RetailerId, UserId } from "@paon/domain";

import type { getSupabaseServerClient } from "@/lib/supabase-server";

type SupabaseServerClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

/**
 * `update_cart_line` scopes only by `auth.uid()` and `status = 'draft'` (see
 * `20260720000009_create_persisted_cart_checkout.sql`) — it never checks which
 * retailer the line belongs to. Both cart mutation paths, meanwhile, gate the
 * `commerce_growth` module on the retailer resolved from the URL slug.
 *
 * Those two facts together mean a customer holding draft carts at two
 * retailers could present retailer A's slug with a line id from retailer B's
 * cart: the module gate passes against A, and the RPC happily mutates B's line
 * because it only cares that the caller owns it. B's module entitlement is
 * bypassed.
 *
 * This asserts the line actually belongs to the slug's retailer's cart, so the
 * module gate applies to the retailer whose data is being changed. It is not a
 * data-leak fix — the RPC already prevents touching another customer's cart —
 * it makes the entitlement boundary real.
 *
 * Throws with the RPC's own "Cart line not found" wording so a mismatch is
 * indistinguishable from a genuinely absent line and reveals nothing about
 * which other retailer holds it.
 */
export async function assertCartLineBelongsToRetailer(
  supabase: SupabaseServerClient,
  retailerId: RetailerId,
  userId: UserId,
  lineId: string,
): Promise<void> {
  const relationships = await new CustomerRepository(supabase).findByUserId(
    userId,
  );
  const customer = relationships.find(
    (relationship) => relationship.retailerId === retailerId,
  );
  if (!customer) throw new Error("Cart line not found");

  const orderRepo = new OrderRepository(supabase);
  const cart = await orderRepo.findCart(retailerId, customer.id);
  if (!cart) throw new Error("Cart line not found");

  const lines = await orderRepo.findLinesByOrder(cart.id);
  if (!lines.some((line) => String(line.id) === lineId))
    throw new Error("Cart line not found");
}
