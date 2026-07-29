import { ProductRepository, ProductVariantRepository } from "@paon/database";
import type { RetailerId } from "@paon/domain";

import type { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The HTML storefront's guest favorites panel stores product **slugs**
 * (`paon-template.html`'s own `p.id`), never variant ids — a signed-out
 * visitor never resolves a specific variant. This maps a retailer's
 * active catalog back to the first variant per product (same "default
 * variant" convention `route.ts` uses for the storefront's own
 * `variantId`), so `MergeFavorites` has something to hand `toggleItem`.
 */
export async function buildVariantIdByProductSlug(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  retailerId: RetailerId,
): Promise<Record<string, string>> {
  const products = await new ProductRepository(supabase).findByRetailer(
    retailerId,
  );
  const variantRepo = new ProductVariantRepository(supabase);
  const entries = await Promise.all(
    products.map(async (product) => {
      const variants = await variantRepo.findByProduct(product.id);
      return [product.slug, variants[0]?.id] as const;
    }),
  );
  const map: Record<string, string> = {};
  for (const [slug, variantId] of entries) {
    if (variantId) map[slug] = variantId;
  }
  return map;
}
