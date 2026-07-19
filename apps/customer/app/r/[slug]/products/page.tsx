import { ProductRepository, RetailerRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function StorefrontProductsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") {
    notFound();
  }

  const products = (
    await new ProductRepository(supabase).findByRetailer(retailer.id)
  ).filter((product) => product.status === "active");

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-1 text-sm font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
        {retailer.displayName}
      </p>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
          Shop
        </h1>
        <Link href={`/r/${slug}/appointments`} className="text-sm underline">
          Book an appointment
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-[var(--color-stone-600)]">
          Nothing available yet — check back soon.
        </p>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/r/${slug}/products/${product.slug}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {product.name}
                </p>
                {product.isMadeToOrder ? (
                  <p className="text-sm text-[var(--color-stone-500)]">
                    Made to order
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </Card>
      )}
    </main>
  );
}
