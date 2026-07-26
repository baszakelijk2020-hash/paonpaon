import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  CollectionRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
} from "@paon/database";
import type { Product, ProductVariant } from "@paon/domain";
import { formatMoney } from "@paon/utils";
import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Serves the founder's actual `paon.html` file, byte-for-byte — every
 * style block, every button, every animation, exactly as designed. The
 * only substitution is the `products` array, which the original hardcodes
 * as sample data: here it's built from the real Supabase-backed catalog
 * for this retailer instead. Everything else in the template — markup,
 * CSS, GSAP interaction logic, mobile redesign — is untouched, which is
 * why this is a Route Handler returning raw HTML rather than a React
 * page: React would only get in the way of reproducing the file exactly.
 */

let templateCache: string | null = null;

async function loadTemplate(): Promise<string> {
  if (templateCache) return templateCache;
  const templatePath = path.join(
    process.cwd(),
    "app/r/[slug]/paon-template.html",
  );
  templateCache = await readFile(templatePath, "utf8");
  return templateCache;
}

function toDetailImg(product: Product): string {
  return product.primaryImageUrl ?? "";
}

function priceLabelFor(variants: readonly ProductVariant[]): string {
  if (variants.length === 0) return "";
  const cheapest = variants.reduce((lowest, variant) =>
    variant.price.amountMinorUnits < lowest.price.amountMinorUnits
      ? variant
      : lowest,
  );
  return formatMoney(cheapest.price, "en-US");
}

function variantNameFor(variants: readonly ProductVariant[]): string {
  const first = variants[0];
  if (!first) return "Selection";
  return [first.size, first.color].filter(Boolean).join(" · ") || first.sku;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") {
    return new NextResponse("Not found", { status: 404 });
  }

  const [productRepo, variantRepo, collectionRepo] = [
    new ProductRepository(supabase),
    new ProductVariantRepository(supabase),
    new CollectionRepository(supabase),
  ];

  const [allProducts, collections] = await Promise.all([
    productRepo.findByRetailer(retailer.id),
    collectionRepo.findByRetailer(retailer.id),
  ]);
  const activeProducts = allProducts.filter((p) => p.status === "active");
  const collectionNameById = new Map(collections.map((c) => [c.id, c.name]));

  const entries = await Promise.all(
    activeProducts.map(async (product) => {
      const variants = await variantRepo.findByProduct(product.id);
      const category =
        product.collectionIds
          .map((id) => collectionNameById.get(id))
          .find((name): name is string => Boolean(name)) ?? "All";
      return {
        id: product.slug,
        img: product.primaryImageUrl ?? "",
        detailImg: toDetailImg(product),
        name: product.name,
        price: priceLabelFor(variants),
        category,
        brand: retailer.displayName,
        description: product.description,
        material: product.isMadeToOrder ? "Made to order" : "In atelier",
        variantName: variantNameFor(variants),
        variantId: variants[0]?.id ?? null,
      };
    }),
  );

  const categories = [...new Set(entries.map((e) => e.category))];
  if (categories.length === 0) categories.push("All");

  const template = await loadTemplate();
  const html = template
    .replaceAll("__PAON_SLUG__", slug)
    .replace("__PAON_RETAILER_NAME__", escapeHtml(retailer.displayName))
    .replace("__PAON_PRODUCTS_JSON__", JSON.stringify(entries))
    .replace("__PAON_CATEGORIES_JSON__", JSON.stringify(categories))
    .replace("__PAON_DEFAULT_CATEGORY_JSON__", JSON.stringify(categories[0]));

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
