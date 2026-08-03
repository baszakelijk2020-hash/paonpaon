import {
  CustomerRepository,
  MicroCapsuleRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
} from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";
import Image from "next/image";
import Link from "next/link";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface CapsulePiece {
  readonly slug: string;
  readonly name: string;
  readonly imageUrl?: string;
  readonly priceLabel?: string;
}

export default async function CapsulePage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const dropRepo = new MicroCapsuleRepository(supabase);
  const productRepo = new ProductRepository(supabase);
  const variantRepo = new ProductVariantRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const drop = await dropRepo.findCurrentPublished(customer.retailerId);
      let pieces: CapsulePiece[] = [];
      if (drop) {
        const dropProducts = await dropRepo.findProductsForDrop(drop.id);
        const resolved = await Promise.all(
          dropProducts.map(async (dropProduct) => {
            const product = await productRepo.findById(dropProduct.productId);
            if (!product) return null;
            const variants = await variantRepo.findByProduct(product.id);
            const piece: CapsulePiece = {
              slug: product.slug,
              name: product.name,
              ...(product.primaryImageUrl
                ? { imageUrl: product.primaryImageUrl }
                : {}),
              ...(variants[0]
                ? { priceLabel: formatMoney(variants[0].price, "en-US") }
                : {}),
            };
            return piece;
          }),
        );
        pieces = resolved.filter(
          (piece): piece is CapsulePiece => piece !== null,
        );
      }
      return { customer, retailer, drop, pieces };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          This week&rsquo;s capsule
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          A small, considered set — refreshed weekly by each house.
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            No house connections yet.
          </p>
        </Card>
      ) : (
        groups.map(({ customer, retailer, drop, pieces }) => (
          <Card key={customer.id} className="flex flex-col gap-4">
            <div>
              <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
                {retailer?.displayName ?? "Retailer"}
              </p>
              {drop ? (
                <>
                  <h2 className="font-display text-xl text-[var(--color-stone-900)]">
                    {drop.title}
                  </h2>
                  {drop.theme ? (
                    <p className="text-sm text-[var(--color-stone-500)]">
                      {drop.theme}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                  No capsule published this week yet.
                </p>
              )}
            </div>
            {pieces.length > 0 ? (
              <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2">
                {pieces.map((piece) => (
                  <Link
                    key={piece.slug}
                    href={`/r/${retailer?.slug}/products/${piece.slug}`}
                    className="flex w-48 shrink-0 snap-start flex-col gap-2 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-stone-200)]"
                  >
                    <div className="relative aspect-[3/4] bg-[var(--color-stone-100)]">
                      {piece.imageUrl ? (
                        <Image
                          src={piece.imageUrl}
                          alt={piece.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="px-2 pb-2">
                      <p className="text-sm font-medium text-[var(--color-stone-900)]">
                        {piece.name}
                      </p>
                      {piece.priceLabel ? (
                        <p className="text-xs text-[var(--color-stone-500)]">
                          {piece.priceLabel}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </Card>
        ))
      )}
    </div>
  );
}
