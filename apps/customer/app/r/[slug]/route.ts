import { readFile } from "node:fs/promises";
import path from "node:path";

import { resolveAppSession } from "@paon/auth";
import {
  CollectionRepository,
  CustomerRepository,
  ProductRepository,
  ProductVariantRepository,
  WardrobeRepository,
  WeddingPartyRepository,
} from "@paon/database";
import { CANONICAL_DEMO_RETAILER_SLUG } from "@paon/database/demo-seed";
import type { Product, ProductVariant } from "@paon/domain";
import { formatMoney } from "@paon/utils";
import { NextResponse } from "next/server";

import {
  CANONICAL_CATEGORIES,
  canonicalCategoryFor,
} from "./canonical-category";
import {
  loadStorefrontCatalogueByProduct,
  preferCatalogueFacetValue,
} from "./serialize-storefront-catalogue";
import { loadStorefrontKnowledgeByProduct } from "./serialize-storefront-knowledge";
import { getStorefrontRetailer } from "./storefront-context";
import {
  serializeStorefrontPage,
  type StorefrontPageData,
} from "./storefront-page-data";

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
  // The table-service widget's embedded style originally pointed at the
  // founder's own domain. Use the same local Google Flex face as the rest
  // of the storefront, avoiding a cross-origin font request.
  const html = raw.replaceAll(
    "/fonts/TN_Web_Use_Only_2.woff2",
    "/fonts/TN_Web_Use_Only_2.woff2",
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
  return "unknown";
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
  if (/summer|spring|tropical|linen/.test(hay)) return "spring-summer";
  if (/winter|autumn|fall|cashmere|flannel/.test(hay)) return "autumn-winter";
  return "unknown";
}

// CANONICAL_CATEGORIES, CATEGORY_KEYWORDS and canonicalCategoryFor moved to
// ./canonical-category.ts so the account-side shop sidebar (a plain React
// component, not a Route Handler — route.ts can only export HTTP method
// handlers) can compute the exact same populated-category list.

const DISPLAY_FONTS: Record<string, string> = {
  paon_editorial: "var(--font-display)",
  heritage: '"Iowan Old Style", "Baskerville", Georgia, serif',
  modern: '"Helvetica Neue", Arial, sans-serif',
};

const BODY_FONTS: Record<string, string> = {
  quiet_sans: "var(--font-sans)",
  humanist: '"Avenir Next", Avenir, "Segoe UI", sans-serif',
};

const CORNERS: Record<string, string> = {
  tailored: "0.25rem",
  soft: "1.25rem",
  architectural: "0rem",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const requestedCategory = new URL(request.url).searchParams.get("category");
  const supabase = await getSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const tableServiceSignedIn = authData.user
    ? resolveAppSession(authData.user).accountType === "customer"
    : false;

  const retailer = await getStorefrontRetailer(slug);
  if (!retailer || retailer.status !== "active") {
    return new NextResponse("Not found", { status: 404 });
  }

  // PAON-added, no source equivalent (same precedent as FT-02's "Select"
  // button): lets a signed-in customer optionally tag a wedding_fabric
  // attachment to one of their own wedding parties.
  let weddingParties: { id: string; label: string }[] = [];
  let garments: { id: string; label: string }[] = [];
  if (tableServiceSignedIn && authData.user) {
    const customers = await new CustomerRepository(supabase).findByUserId(
      resolveAppSession(authData.user).userId,
    );
    const customer = customers.find((row) => row.retailerId === retailer.id);
    if (customer) {
      const [parties, wardrobeItems] = await Promise.all([
        new WeddingPartyRepository(supabase).findByCustomer(customer.id),
        new WardrobeRepository(supabase).findByCustomer(customer.id),
      ]);
      weddingParties = parties.map((party) => ({
        id: party.id,
        label: party.venueName ?? "My wedding party",
      }));
      garments = wardrobeItems
        .filter((item) => !item.retiredAt)
        .map((item) => ({ id: item.id, label: item.displayName }));
    }
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

  // Resolve the intent from the retailer-scoped product catalogue before
  // loading variants and metadata. A category request must not pay for the
  // full catalogue's expensive downstream projections.
  const requestedCategoryHasProducts =
    !!requestedCategory &&
    activeProducts.some((product) => {
      const collectionName = product.collectionIds
        .map((id) => collectionNameById.get(id))
        .find((name): name is string => Boolean(name));
      return (
        canonicalCategoryFor(
          product.name,
          collectionName,
          product.primaryImageUrl ?? "",
        ) === requestedCategory
      );
    });
  const productsForRequest = requestedCategoryHasProducts
    ? activeProducts.filter((product) => {
        const collectionName = product.collectionIds
          .map((id) => collectionNameById.get(id))
          .find((name): name is string => Boolean(name));
        return (
          canonicalCategoryFor(
            product.name,
            collectionName,
            product.primaryImageUrl ?? "",
          ) === requestedCategory
        );
      })
    : activeProducts;

  const variantsByProduct = await variantRepo.findByProducts(
    productsForRequest.map((product) => product.id),
  );
  const productsWithVariants = productsForRequest.map((product) => ({
    product,
    variants: variantsByProduct.get(product.id) ?? [],
  }));

  const knowledgeByProduct = await loadStorefrontKnowledgeByProduct(
    supabase,
    retailer.id,
    productsWithVariants.map(({ product, variants }) => ({
      id: product.id,
      slug: product.slug,
      variantIds: variants.map((variant) => variant.id),
    })),
  );

  const catalogueByProduct = await loadStorefrontCatalogueByProduct(
    supabase,
    retailer.id,
    productsWithVariants.map(({ product, variants }) => ({
      id: product.id,
      slug: product.slug,
      variantIds: variants.map((variant) => variant.id),
    })),
  );

  const entries = productsWithVariants.map(({ product, variants }) => {
    const collectionName = product.collectionIds
      .map((id) => collectionNameById.get(id))
      .find((name): name is string => Boolean(name));
    const catalogue = catalogueByProduct[product.slug];
    return {
      id: product.slug,
      img: product.primaryImageUrl ?? "",
      detailImg: toDetailImg(product),
      name: product.name,
      price: priceLabelFor(variants),
      priceMinor: priceMinorFor(variants),
      color: preferCatalogueFacetValue(
        catalogue?.color,
        deriveColor(product.name, variants[0]?.color),
      ),
      pattern: preferCatalogueFacetValue(
        catalogue?.pattern,
        derivePattern(product.name),
      ),
      season: preferCatalogueFacetValue(
        catalogue?.season,
        deriveSeason(product.name, undefined),
      ),
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
      inventoryQuantity: variants[0]?.inventoryQuantity ?? 0,
      // Made-to-order lines are never "sold out" — there is no fixed
      // inventory to exhaust, only a lead time. A stocked line with
      // nothing left is the one case this storefront should stop
      // selling instead of quietly overselling (Critical 1).
      soldOut:
        !product.isMadeToOrder && (variants[0]?.inventoryQuantity ?? 0) <= 0,
      // SRCH-001 narrow metadata hooks — heuristics remain when absent.
      conceptIds: catalogue?.conceptIds ?? [],
      mill: catalogue?.mill ?? null,
      weave: catalogue?.weave ?? null,
      weightGsm: catalogue?.weightGsm ?? null,
    };
  });

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
  // An explicit `?category=` (from the account-side shop sidebar) wins
  // over the most-populated-category default, but only if that category
  // actually has products — otherwise a click into an empty category
  // would silently render nothing instead of falling back to a real one.
  const defaultCategory = requestedCategoryHasProducts
    ? requestedCategory!
    : ([...countByCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "");

  const theme = retailer.brandTheme;
  const accent = safeHex(theme.accentColor) ?? "#1a1a1a";
  const surface = safeHex(theme.surfaceColor) ?? "#f5f3f0";
  const ink = safeHex(theme.inkColor) ?? "#1a1a1a";
  const logoUrl = safeHttpsUrl(theme.logoUrl);
  const faviconUrl = safeHttpsUrl(theme.faviconUrl) ?? logoUrl;
  const heroUrl = safeHttpsUrl(theme.heroImageUrl);
  const safeName = escapeHtml(retailer.displayName);
  const displayFont =
    DISPLAY_FONTS[theme.displayFont] ?? DISPLAY_FONTS.paon_editorial;
  const bodyFont = BODY_FONTS[theme.bodyFont] ?? BODY_FONTS.quiet_sans;
  const radius = CORNERS[theme.cornerStyle] ?? CORNERS.tailored;

  const brandHead = [
    logoUrl || heroUrl
      ? `<link rel="preload" as="image" href="${escapeHtml(logoUrl ?? heroUrl!)}"/>`
      : "",
    faviconUrl ? `<link rel="icon" href="${escapeHtml(faviconUrl)}"/>` : "",
    `<style id="paon-retailer-brand">
:root {
  --paon-accent: ${accent};
  --paon-surface: ${surface};
  --paon-ink: ${ink};
  --font-retailer-display: ${displayFont};
  --font-retailer-body: ${bodyFont};
  --retailer-radius: ${radius};
}
body {
  font-family: var(--font-retailer-body), var(--font-sans), system-ui, sans-serif;
}
.font-display, .sidebar-brand, #sidebar-logo, .product-name, .modal-title {
  font-family: var(--font-retailer-display), var(--font-display), Georgia, serif;
}
#sidebar-logo {
  background: linear-gradient(to right, ${accent}, ${ink}) !important;
  border-radius: var(--retailer-radius);
}
${
  logoUrl
    ? `#sidebar-logo { flex-direction: column; gap: 6px; padding: 8px 12px; }
#sidebar-logo .paon-retailer-logo {
  max-height: 28px; max-width: 140px; width: auto; height: auto;
  object-fit: contain; display: block;
}
#lagilda-shimmer-unique { display: none !important; }`
    : ""
}
${
  heroUrl
    ? `.paon-retailer-hero {
  width: 100%; max-height: min(42vh, 420px); overflow: hidden;
  margin: 0 0 12px; border-radius: 0;
}
.paon-retailer-hero img {
  width: 100%; height: min(42vh, 420px); object-fit: cover; display: block;
}`
    : ""
}
</style>`,
  ]
    .filter(Boolean)
    .join("\n");

  const brandMark = logoUrl
    ? `<img class="paon-retailer-logo" src="${escapeHtml(logoUrl)}" alt="${safeName}"/>`
    : "";

  const heroHtml = heroUrl
    ? `<div class="paon-retailer-hero" aria-hidden="true"><img src="${escapeHtml(heroUrl)}" alt=""/></div>`
    : "";

  const usesSharedCataloguePhotography =
    slug !== CANONICAL_DEMO_RETAILER_SLUG &&
    entries.length > 0 &&
    entries.every(
      (entry) => !entry.img || entry.img.includes("nebelspiegel.com/images/"),
    );
  const catalogueNoteHtml = usesSharedCataloguePhotography
    ? `<p class="paon-catalogue-note" style="margin:6px 12px 0;font-size:10px;line-height:1.35;letter-spacing:.04em;text-transform:uppercase;opacity:.45;font-family:var(--font-retailer-body),system-ui,sans-serif;">Shared catalogue photography · ${safeName}</p>`
    : "";
  // Always shown, not only alongside shared photography (Critical 1):
  // fabric/archetype naming on this grid is inspiration copy, not a
  // confirmed mill or measurement — the advisor confirms both in the
  // fitting. Same note style as the catalogue-photography disclosure.
  const configHonestyNoteHtml = `<p class="paon-catalogue-note" style="margin:6px 12px 0;font-size:10px;line-height:1.35;letter-spacing:.04em;text-transform:uppercase;opacity:.45;font-family:var(--font-retailer-body),system-ui,sans-serif;">Fabric &amp; archetype are inspiration — your advisor confirms mill and measurements in fitting.</p>`;

  const template = await loadTemplate();
  const demoStory = await prospectDemoStoryFor(supabase, slug);
  const stores = await appointmentStoresFor(
    supabase,
    retailer,
    heroUrl,
    demoStory?.locations,
  );
  // One short line only — long Studio introductions belong on the private
  // demo gate, not above the founder collection grid (ADR-052: data hook,
  // founder chrome vocabulary).
  const storyLine = (demoStory?.marketingHeadline ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72);
  const storyHtml = storyLine
    ? `<div class="paon-story" style="margin:10px 12px 2px;padding:0 0 10px;border-bottom:1px solid color-mix(in srgb, var(--paon-ink) 12%, transparent);">
<p style="margin:0;font-family:var(--font-retailer-display),Georgia,serif;font-size:13px;line-height:1.3;letter-spacing:.01em;color:var(--paon-ink);">${escapeHtml(storyLine)}</p>
</div>`
    : "";
  // CANONICAL_CATEGORIES here, not UNAMBIGUOUS_CATEGORY_ORDER: that list
  // deliberately excludes "Suits" (it exists only to control keyword-check
  // priority in canonicalCategoryFor, checked before the Suits fallback),
  // so reusing it for the sidebar nav meant Suits could never appear there
  // no matter how many suit products existed.
  const categoryNames = CANONICAL_CATEGORIES.filter((category) =>
    entries.some((entry) => entry.category === category),
  );
  const resolvedCategories =
    categoryNames.length > 0 ? categoryNames : [...CANONICAL_CATEGORIES];
  // An explicit category click (account-side shop sidebar, or any other
  // "take me to this category" link) is unambiguous shopping intent — it
  // always lands on the grid, even for the canonical demo retailer whose
  // organic visits open on the curated story/gate page first.
  const landOnGrid =
    slug !== CANONICAL_DEMO_RETAILER_SLUG || requestedCategoryHasProducts;
  const ogTitle = storyLine
    ? `${safeName} — ${escapeHtml(storyLine)}`
    : safeName;
  const ogDescription = `Explore ${safeName} on PAON.`;
  const ogImage =
    heroUrl ??
    entries.find((entry) => entry.img)?.img ??
    "https://www.nebelspiegel.com/images/smaller/6088.webp";

  const footerYear = new Date().getFullYear();
  const footerCities = [...new Set(stores.map((store) => store.city))].slice(
    0,
    4,
  );
  const footerHtml = `<footer style="margin-top:64px;background:linear-gradient(160deg,#1a1a1a 0%,#2b2b2b 100%);color:rgba(255,255,255,.72);font-family:var(--font-retailer-body),system-ui,sans-serif;">
<div style="max-width:1240px;margin:0 auto;padding:56px 24px 28px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:32px;">
<div>
<p style="margin:0 0 14px;font-family:var(--font-retailer-display),Georgia,serif;font-size:20px;letter-spacing:.03em;color:#fff;">${safeName}</p>
<p style="margin:0;font-size:12px;line-height:1.7;color:rgba(255,255,255,.5);">Tailored pieces, made to measure and kept by one house.</p>
</div>
<div>
<p style="margin:0 0 12px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.4);">Client Services</p>
<p style="margin:0 0 8px;font-size:13px;"><a href="/r/${slug}/appointments" style="color:inherit;text-decoration:none;">Book an appointment</a></p>
<p style="margin:0 0 8px;font-size:13px;"><a href="#gilda-chat-widget" style="color:inherit;text-decoration:none;">Table service</a></p>
<p style="margin:0;font-size:13px;"><a href="/dashboard" style="color:inherit;text-decoration:none;">Your account</a></p>
</div>
${
  footerCities.length > 0
    ? `<div>
<p style="margin:0 0 12px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.4);">Ateliers</p>
${footerCities.map((city) => `<p style="margin:0 0 8px;font-size:13px;">${escapeHtml(city)}</p>`).join("\n")}
<p style="margin:8px 0 0;font-size:13px;"><a href="/r/${slug}/locations" style="color:inherit;text-decoration:none;">All locations</a></p>
</div>`
    : ""
}
</div>
<div style="max-width:1240px;margin:0 auto;padding:20px 24px;border-top:1px solid rgba(255,255,255,.1);font-size:11px;letter-spacing:.04em;color:rgba(255,255,255,.35);">© ${footerYear} ${safeName}. All rights reserved.</div>
</footer>`;

  const pageData: StorefrontPageData = {
    slug,
    retailerId: retailer.id,
    tableServiceSignedIn,
    weddingParties,
    garments,
    retailerName: safeName,
    ogTitle,
    ogDescription,
    ogImage: escapeHtml(ogImage),
    brandHead,
    brandMark,
    heroHtml: heroHtml + storyHtml + catalogueNoteHtml + configHonestyNoteHtml,
    entries,
    defaultCategory,
    categoryNames: resolvedCategories,
    landOnGrid,
    stores,
    knowledgeByProduct,
    catalogueByProduct,
    footerHtml,
  };
  const html = serializeStorefrontPage(template, pageData);

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

const MAISON_APPOINTMENT_STORES = [
  {
    city: "Antwerp",
    address: "Lombardenstraat 2,\n2000 Antwerp",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Antwerpen_Centraal_station_2.jpg/320px-Antwerpen_Centraal_station_2.jpg",
  },
  {
    city: "Amsterdam",
    address: "PC Hooftstraat 48,\n1071 BZ Amsterdam",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/KeijssKramer_PCHooftstraat.jpg/320px-KeijsKramer_PCHooftstraat.jpg",
  },
] as const;

async function prospectDemoStoryFor(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  slug: string,
): Promise<
  | {
      marketingHeadline?: string | undefined;
      personalizedIntroduction?: string | undefined;
      locations?: Array<{
        name?: string;
        city?: string;
        imageUrl?: string;
      }>;
    }
  | undefined
> {
  const { data: environment } = await supabase
    .from("prospect_demo_environments")
    .select("configuration_id")
    .eq("retailer_slug", slug)
    .maybeSingle();
  if (!environment?.configuration_id) return undefined;
  const { data: configuration } = await supabase
    .from("prospect_demo_configurations")
    .select("locations, marketing_headline, personalized_introduction")
    .eq("id", environment.configuration_id)
    .maybeSingle();
  if (!configuration) return undefined;
  const story: {
    marketingHeadline?: string | undefined;
    personalizedIntroduction?: string | undefined;
    locations?: Array<{
      name?: string;
      city?: string;
      imageUrl?: string;
    }>;
  } = {};
  if (configuration.marketing_headline) {
    story.marketingHeadline = configuration.marketing_headline;
  }
  if (configuration.personalized_introduction) {
    story.personalizedIntroduction = configuration.personalized_introduction;
  }
  if (configuration.locations) {
    story.locations = configuration.locations as Array<{
      name?: string;
      city?: string;
      imageUrl?: string;
    }>;
  }
  return story;
}

async function appointmentStoresFor(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  retailer: {
    slug: string;
    displayName: string;
    billingAddress: { city: string; line1?: string };
  },
  heroUrl: string | undefined,
  locations?: Array<{
    name?: string;
    city?: string;
    imageUrl?: string;
  }>,
): Promise<Array<{ city: string; address: string; img: string }>> {
  if (retailer.slug === CANONICAL_DEMO_RETAILER_SLUG) {
    return [...MAISON_APPOINTMENT_STORES];
  }

  const fallbackImg =
    heroUrl ?? "https://www.nebelspiegel.com/images/smaller/6054.webp";

  const resolvedLocations =
    locations ??
    (await prospectDemoStoryFor(supabase, retailer.slug))?.locations;

  if (Array.isArray(resolvedLocations) && resolvedLocations.length > 0) {
    return resolvedLocations
      .filter((location) => location.city || location.name)
      .map((location) => ({
        city: location.city || location.name || retailer.displayName,
        address: [location.name, location.city].filter(Boolean).join(",\n"),
        img: safeHttpsUrl(location.imageUrl) ?? fallbackImg,
      }));
  }

  return [
    {
      city: retailer.billingAddress.city || retailer.displayName,
      address: [
        retailer.displayName,
        retailer.billingAddress.line1,
        retailer.billingAddress.city,
      ]
        .filter(Boolean)
        .join(",\n"),
      img: fallbackImg,
    },
  ];
}

function safeHex(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^#[0-9A-Fa-f]{3,8}$/.test(value) ? value : undefined;
}

function safeHttpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
