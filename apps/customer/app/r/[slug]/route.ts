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
 *
 * The template's `categories` filter list (Suits/Jackets/Pants/Knits/
 * Shoes/Shirts/Outerwear/Evening/Wedding) is the founder's own fixed
 * taxonomy — not templated, left exactly as he wrote it. Its `getCat()`
 * bucketing is keyed to his own sample data's numeric/`broek`/`schoen` id
 * scheme, which real slug-based products never match, so `entries` below
 * carries a `category` already resolved to one of those exact canonical
 * names (a small keyword match over the product name/collection), and a
 * one-line addition to `getCat()` (`paon-template.html`) trusts an exact
 * match before falling back to the founder's own heuristic.
 */

let templateCache: string | null = null;

async function loadTemplate(): Promise<string> {
  // In dev, always re-read so edits to paon-template.html show up without
  // restarting the customer app (the module-level cache otherwise sticks
  // for the whole process lifetime).
  if (process.env.NODE_ENV !== "development" && templateCache) {
    return templateCache;
  }
  const templatePath = path.join(
    process.cwd(),
    "app/r/[slug]/paon-template.html",
  );
  const raw = await readFile(templatePath, "utf8");
  // The table-service widget's embedded <style> still points at the
  // founder's own domain for this one font. That host sends no
  // Access-Control-Allow-Origin, so the browser silently fails the fetch
  // and falls back to a system font — same CORS issue globals.css already
  // works around via app/fonts/[filename]/route.ts, which serves this exact
  // file same-origin. Confirmed broken in production before this fix.
  const html = raw.replaceAll(
    "https://www.nebelspiegel.com/fonts/optimaklein.woff2",
    "/fonts/optimaklein.woff2",
  );
  templateCache = html;
  return html;
}

function toDetailImg(product: Product): string {
  return product.swatchImageUrl ?? product.primaryImageUrl ?? "";
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

function priceMinorFor(variants: readonly ProductVariant[]): number {
  if (variants.length === 0) return 0;
  return variants.reduce((lowest, variant) =>
    variant.price.amountMinorUnits < lowest.price.amountMinorUnits
      ? variant
      : lowest,
  ).price.amountMinorUnits;
}

function deriveColor(name: string, variantColor?: string): string {
  const fromVariant = variantColor?.trim().toLowerCase();
  if (fromVariant) {
    if (fromVariant.includes("navy") || fromVariant.includes("midnight"))
      return "navy";
    if (fromVariant.includes("grey") || fromVariant.includes("gray"))
      return "grey";
    if (fromVariant.includes("brown") || fromVariant.includes("chocolate"))
      return "brown";
    if (
      fromVariant.includes("beige") ||
      fromVariant.includes("cream") ||
      fromVariant.includes("khaki") ||
      fromVariant.includes("sand")
    )
      return "beige";
    if (fromVariant.includes("blue")) return "blue";
    if (fromVariant.includes("black")) return "black";
    if (
      fromVariant.includes("green") ||
      fromVariant.includes("olive") ||
      fromVariant.includes("sage")
    )
      return "green";
  }
  const hay = name.toLowerCase();
  if (/navy|midnight/.test(hay)) return "navy";
  if (/grey|gray|charcoal|smoke/.test(hay)) return "grey";
  if (/brown|chocolate|rust|camel|taupe|espresso/.test(hay)) return "brown";
  if (/beige|ivory|cream|ecru|khaki|sand|oatmeal|tobacco/.test(hay))
    return "beige";
  if (/blue|teal|aqua|powder blue|dusty blue/.test(hay)) return "blue";
  if (/black/.test(hay)) return "black";
  if (/green|sage|olive|forest/.test(hay)) return "green";
  return "beige";
}

function derivePattern(name: string): string {
  const hay = name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (hay.includes("herringbone")) return "herringbone";
  if (hay.includes("glencheck")) return "glencheck";
  if (hay.includes("houndstooth")) return "houndstooth";
  if (hay.includes("sharkskin")) return "sharkskin";
  if (hay.includes("basketweave")) return "basketweave";
  if (hay.includes("windowpane")) return "windowpane";
  if (hay.includes("twill")) return "twill";
  if (hay.includes("melange") || hay.includes("mélange")) return "melange";
  if (hay.includes("cable")) return "cable";
  return "plain";
}

function deriveSeason(name: string, collectionSeason?: string): string {
  const hay = `${name} ${collectionSeason ?? ""}`.toLowerCase();
  if (/summer|spring|tropical|linen|light/.test(hay)) return "spring-summer";
  if (/winter|autumn|fall|cashmere|flannel|heavy/.test(hay))
    return "autumn-winter";
  return "all-season";
}

const CANONICAL_CATEGORIES = [
  "Suits",
  "Jackets",
  "Pants",
  "Knits",
  "Shoes",
  "Shirts",
  "Outerwear",
  "Evening",
  "Wedding",
] as const;

const CATEGORY_KEYWORDS: Record<
  (typeof CANONICAL_CATEGORIES)[number],
  readonly string[]
> = {
  // "suit" only — weave-pattern words (twill/houndstooth/glencheck/mélange)
  // used to live here too, but those describe jacket fabrics just as often
  // as suit fabrics (see the id-range fallback below), so keeping them
  // here was mis-sorting real jacket fabrics into Suits by coincidence of
  // wording, not garment type.
  Suits: ["suit"],
  Jackets: ["jacket", "blazer", "sport coat", "sportcoat"],
  // "broek" still matches trouser slugs (`…-broek1`); display names follow
  // the product photography (e.g. "Khaki Cotton Trousers").
  Pants: ["pant", "trouser", "chino", "broek"],
  Knits: [
    "knit",
    "sweater",
    "cardigan",
    "jumper",
    "roll neck",
    "rollneck",
    "turtleneck",
    "crew",
    "polo",
    "merino",
    "cashmere",
    "quarter-zip",
    "cable",
  ],
  Shoes: ["shoe", "loafer", "oxford", "derby", "boot", "sneaker"],
  Shirts: ["shirt"],
  Outerwear: ["overcoat", "parka", "topcoat"],
  Evening: ["tuxedo", "evening", "black tie", "dinner jacket"],
  Wedding: ["wedding", "groom"],
};

/** Categories with an unambiguous name-keyword — checked before the
 * Suits/Jackets id-range fallback so an explicit garment word (e.g. a
 * "Sport Coat" or "Overcoat" that happens to reuse a suit fabric's own
 * product photo) always wins over which numbered fabric photo it reuses. */
const UNAMBIGUOUS_CATEGORY_ORDER = CANONICAL_CATEGORIES.filter(
  (category) => category !== "Suits",
);

/** Names with no real garment type at all (accessories) shouldn't fall
 * into the Suits/Jackets id-range guess just because they reuse one of
 * those fabrics' product photography. */
const NON_GARMENT_NAME_HINTS = [
  "pocket square",
  "tie",
  "cufflink",
  "belt",
  "briefcase",
  "bag",
  "wallet",
  "satchel",
  "tote",
  "pouch",
  "watch",
  "sunglasses",
  "hat",
  "scarf",
];

/**
 * The founder's own real catalog (`paon.html`) numbers suit fabrics
 * below 8000 and jacket fabrics at or above it (its own `getCat()`:
 * `parseInt(id) < 8000 ? 'Suits' : 'Jackets'`) — the demo seed reuses
 * those exact numbered photos (`smaller/9177.webp`, etc.) for several
 * products, some of which are misleadingly named "X Suiting Fabric"
 * even when the numbered photo is actually a jacket fabric (id ≥ 8000).
 * No keyword list can recover the right category from a name that says
 * "Suiting Fabric" on a jacket fabric — only the founder's own id
 * scheme can, so it's consulted directly as a fallback once no explicit
 * garment word settles it.
 */
function suitOrJacketFromImageId(imagePath: string): string | null {
  const match = /(\d{4})\.\w+(?:$|\?)/.exec(imagePath);
  if (!match?.[1]) return null;
  const id = Number(match[1]);
  if (id < 6000 || id > 9999) return null; // outside the founder's fabric-id range entirely
  return id < 8000 ? "Suits" : "Jackets";
}

/** Maps to the template's fixed filter taxonomy — "" is that taxonomy's
 * own catch-all bucket, not a made-up fallback. */
function canonicalCategoryFor(
  productName: string,
  collectionName: string | undefined,
  imagePath: string,
): string {
  const haystack = `${productName} ${collectionName ?? ""}`.toLowerCase();

  for (const category of UNAMBIGUOUS_CATEGORY_ORDER) {
    if (
      CATEGORY_KEYWORDS[category].some((keyword) => haystack.includes(keyword))
    ) {
      return category;
    }
  }

  if (!NON_GARMENT_NAME_HINTS.some((hint) => haystack.includes(hint))) {
    const byImageId = suitOrJacketFromImageId(imagePath);
    if (byImageId) return byImageId;
  }

  if (CATEGORY_KEYWORDS.Suits.some((keyword) => haystack.includes(keyword))) {
    return "Suits";
  }

  return "";
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
      const collectionName = product.collectionIds
        .map((id) => collectionNameById.get(id))
        .find((name): name is string => Boolean(name));
      return {
        id: product.slug,
        img: product.primaryImageUrl ?? "",
        detailImg: toDetailImg(product),
        name: product.name,
        price: priceLabelFor(variants),
        priceMinor: priceMinorFor(variants),
        color: deriveColor(product.name, variants[0]?.color),
        pattern: derivePattern(product.name),
        season: deriveSeason(product.name, undefined),
        category: canonicalCategoryFor(
          product.name,
          collectionName,
          product.primaryImageUrl ?? "",
        ),
        brand: retailer.displayName,
        description: product.description,
        material: product.isMadeToOrder ? "Made to order" : "In atelier",
        variantName: variantNameFor(variants),
        variantId: variants[0]?.id ?? null,
      };
    }),
  );

  // The category with the most matching products, so the first thing a
  // visitor sees is the fullest grid the catalog can show — not just
  // whichever bucket the first product happened to land in.
  const countByCategory = new Map<string, number>();
  for (const entry of entries) {
    countByCategory.set(
      entry.category,
      (countByCategory.get(entry.category) ?? 0) + 1,
    );
  }
  const defaultCategory =
    [...countByCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const template = await loadTemplate();
  const html = template
    .replaceAll("__PAON_SLUG__", slug)
    .replaceAll("__PAON_RETAILER_ID__", retailer.id)
    .replace("__PAON_RETAILER_NAME__", escapeHtml(retailer.displayName))
    .replace("__PAON_PRODUCTS_JSON__", JSON.stringify(entries))
    .replace("__PAON_DEFAULT_CATEGORY_JSON__", JSON.stringify(defaultCategory));

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
