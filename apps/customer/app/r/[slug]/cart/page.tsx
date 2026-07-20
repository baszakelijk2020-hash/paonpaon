import {
  CustomerRepository,
  OrderRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
} from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CartClient } from "./cart-client";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function CartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  if (!session || session.accountType !== "customer")
    redirect(`/login?redirectTo=/r/${slug}/cart`);
  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer) notFound();
  const relationships = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = relationships.find(
    (item) => item.retailerId === retailer.id,
  );
  const orderRepo = new OrderRepository(supabase);
  const cart = customer
    ? await orderRepo.findCart(retailer.id, customer.id)
    : null;
  const lines = cart ? await orderRepo.findLinesByOrder(cart.id) : [];
  const items = (
    await Promise.all(
      lines.map(async (line) => {
        const variant = await new ProductVariantRepository(supabase).findById(
          line.productVariantId,
        );
        const product = variant
          ? await new ProductRepository(supabase).findById(variant.productId)
          : null;
        return variant && product ? { line, variant, product } : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => !!item);
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-[var(--font-accent)] font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
            {retailer.displayName}
          </p>
          <h1 className="text-3xl font-[var(--font-display)] text-[var(--color-stone-900)]">
            Your cart
          </h1>
        </div>
        <Link href={`/r/${slug}/products`} className="text-sm hover:underline">
          Continue shopping
        </Link>
      </div>
      {!cart || items.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            Your cart is empty.
          </p>
        </Card>
      ) : (
        <CartClient slug={slug} order={cart} items={items} />
      )}
    </main>
  );
}
