import {
  CustomerRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  WishlistRepository,
} from "@paon/database";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";
import Link from "next/link";

import { removeFromWishlist } from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function WishlistPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const wishlistRepo = new WishlistRepository(supabase);
  const variantRepo = new ProductVariantRepository(supabase);
  const productRepo = new ProductRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const wishlist = await wishlistRepo.findByCustomer(customer.id);
      const items = wishlist ? await wishlistRepo.findItems(wishlist.id) : [];
      const resolved = (
        await Promise.all(
          items.map(async (item) => {
            const variant = await variantRepo.findById(item.productVariantId);
            const product = variant
              ? await productRepo.findById(variant.productId)
              : null;
            return variant && product ? { item, variant, product } : null;
          }),
        )
      ).filter((entry): entry is NonNullable<typeof entry> => !!entry);
      return { customer, retailer, items: resolved };
    }),
  );
  const nonEmptyGroups = groups.filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Wishlist
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Products you&rsquo;ve saved across retailers.
        </p>
      </div>

      {nonEmptyGroups.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">Nothing saved yet.</p>
        </div>
      ) : (
        nonEmptyGroups.map(({ customer, retailer, items }) => (
          <Card key={customer.id} className="flex flex-col gap-1">
            <h2 className="mb-2 text-lg font-medium">
              {retailer?.displayName ?? "Retailer"}
            </h2>
            <div className="flex flex-col divide-y divide-[var(--color-stone-100)]">
              {items.map(({ item, variant, product }) => (
                <div
                  key={`${item.wishlistId}-${item.productVariantId}`}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <Link
                      href={`/r/${retailer?.slug}/products/${product.slug}`}
                      className="font-medium hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="text-sm text-[var(--color-stone-500)]">
                      {[variant.size, variant.color]
                        .filter(Boolean)
                        .join(" · ") || variant.sku}{" "}
                      · {formatMoney(variant.price, "en-US")}
                    </p>
                  </div>
                  <form action={removeFromWishlist}>
                    <input
                      type="hidden"
                      name="retailerId"
                      value={customer.retailerId}
                    />
                    <input
                      type="hidden"
                      name="productVariantId"
                      value={item.productVariantId}
                    />
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
