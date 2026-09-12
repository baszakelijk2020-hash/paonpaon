import {
  CustomerRepository,
  MicroCapsuleRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
} from "@paon/database";
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
    <div className="customer-page flex flex-col gap-6 pb-12 text-white">
      <header className="pe-page-head items-end gap-6 pb-3">
        <div>
          <p className="customer-kicker mb-2">
            Refreshed weekly by your advisor
          </p>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.055em] text-white">
            This week&rsquo;s capsule
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/60">
            A small, considered set — the pieces that work together this week,
            chosen for you.
          </p>
        </div>
      </header>

      {groups.length === 0 ? (
        <section className="pe-card" data-pe-card>
          <p className="customer-kicker">Capsule</p>
          <p className="mt-1">No house connections yet.</p>
        </section>
      ) : (
        groups.map(({ customer, retailer, drop, pieces }) => (
          /*
           * One card per house. The house is the kicker, the drop's title is
           * the card's heading, its theme the line under it — no second
           * "This week's edit" title repeating the page's own.
           */
          <section key={customer.id} className="pe-card" data-pe-card>
            <p className="customer-kicker">
              {retailer?.displayName ?? "Retailer"}
            </p>
            {drop ? (
              <>
                <h2 className="mt-2">{drop.title}</h2>
                {drop.theme ? <p className="mt-1">{drop.theme}</p> : null}
              </>
            ) : (
              <p className="mt-1">No capsule published this week yet.</p>
            )}
            {pieces.length > 0 ? (
              <div className="pe-capsule-pieces">
                {pieces.map((piece) => (
                  <Link
                    key={piece.slug}
                    href={`/r/${retailer?.slug}/products/${piece.slug}`}
                    className="pe-capsule-piece"
                  >
                    <span className="pe-capsule-piece-photo">
                      {piece.imageUrl ? (
                        <Image
                          src={piece.imageUrl}
                          alt={piece.name}
                          fill
                          unoptimized
                          sizes="220px"
                        />
                      ) : null}
                    </span>
                    <span className="pe-capsule-piece-name">{piece.name}</span>
                    {piece.priceLabel ? (
                      <span className="pe-capsule-piece-price">
                        {piece.priceLabel}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        ))
      )}
    </div>
  );
}
