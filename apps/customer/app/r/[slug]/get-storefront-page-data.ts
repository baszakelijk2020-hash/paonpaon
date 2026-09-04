import { resolveAppSession, type AuthUserLike } from "@paon/auth";
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
import type { StorefrontPageData } from "./storefront-page-data";

import { getSupabaseServerClient } from "@/lib/supabase-server";

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

export async function getStorefrontPageData(
  slug: string,
  authData?: { user: AuthUserLike | null | undefined },
  requestedCategory?: string | null,
): Promise<StorefrontPageData | null> {
  const supabase = await getSupabaseServerClient();
  const retailer = await getStorefrontRetailer(slug);
  if (!retailer || retailer.status !== "active") {
    return null;
  }

  const tableServiceSignedIn = authData?.user
    ? resolveAppSession(authData.user).accountType === "customer"
    : false;

  // PAON-added, no source equivalent (same precedent as FT-02's "Select"
  // button): lets a signed-in customer optionally tag a wedding_fabric
  // attachment to one of their own wedding parties.
  let weddingParties: { id: string; label: string }[] = [];
  let garments: { id: string; label: string }[] = [];
  if (tableServiceSignedIn && authData?.user) {
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

  // The sidebar's category list must reflect the retailer's whole active
  // catalogue, never just whichever slice a `?category=` request happens to
  // load below (that slice exists purely to skip paying for the full
  // catalogue's downstream projections on a scoped request — it must not
  // also narrow what the nav shows, or clicking a category link collapses
  // the sidebar to that one category instead of highlighting it within the
  // full list).
  const allActiveCategoryNames = new Set(
    activeProducts.map((product) => {
      const collectionName = product.collectionIds
        .map((id) => collectionNameById.get(id))
        .find((name): name is string => Boolean(name));
      return canonicalCategoryFor(
        product.name,
        collectionName,
        product.primaryImageUrl ?? "",
      );
    }),
  );
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

  const ogTitle = storyLine
    ? `${safeName} — ${escapeHtml(storyLine)}`
    : safeName;
  const ogDescription = `Explore ${safeName} on PAON.`;
  const ogImage =
    heroUrl ??
    entries.find((entry) => entry.img)?.img ??
    "https://www.nebelspiegel.com/images/smaller/6088.webp";

  // CANONICAL_CATEGORIES here, not UNAMBIGUOUS_CATEGORY_ORDER: that list
  // deliberately excludes "Suits" (it exists only to control keyword-check
  // priority in canonicalCategoryFor, checked before the Suits fallback),
  // so reusing it for the sidebar nav meant Suits could never appear there
  // no matter how many suit products existed.
  const categoryNames = CANONICAL_CATEGORIES.filter((category) =>
    allActiveCategoryNames.has(category),
  );
  const resolvedCategories =
    categoryNames.length > 0 ? categoryNames : [...CANONICAL_CATEGORIES];
  // An explicit category click (account-side shop sidebar, or any other
  // "take me to this category" link) is unambiguous shopping intent — it
  // always lands on the grid, even for the canonical demo retailer whose
  // organic visits open on the curated story/gate page first.
  const landOnGrid =
    slug !== CANONICAL_DEMO_RETAILER_SLUG || requestedCategoryHasProducts;

  const footerYear = new Date().getFullYear();
  const footerCities = [...new Set(stores.map((store) => store.city))].slice(
    0,
    4,
  );

  // Build script injections and brand CSS (matching route.ts structure exactly)
  // Store/My PAON context switcher: shown for every visitor, signed in or
  // not — matches the dashboard sidebar exactly.
  const contextSwitcherScript = `<script id="paon-context-switcher-inject">
(function() {
  if (document.getElementById("paon-context-switcher")) return;
  function init() {
    const logoEl = document.getElementById("sidebar-logo");
    if (!logoEl) return;

    const currentPathname = location.pathname + location.search;

    const switcherEl = document.createElement("div");
    switcherEl.id = "paon-context-switcher";
    switcherEl.className = "paon-context-switcher";
    switcherEl.innerHTML = \`
      <style>
        #paon-context-switcher {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: linear-gradient(to right, rgba(255,255,255,.045), rgba(255,255,255,0)), linear-gradient(to right, #262626, #1d1d1d);
          padding: 14px 25px;
          margin: 0;
        }
        .pcs-store, .pcs-mypaon {
          position: relative;
          display: inline-block;
          padding: 0;
          margin: 0;
          text-decoration: none;
          font-family: GTBold3, Arial, sans-serif;
          font-size: 7px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          background: transparent;
          border: none;
          cursor: pointer;
        }
        .pcs-inactive {
          color: #8a8a87;
          opacity: 0.7;
        }
        .pcs-active {
          color: #d9d9d9;
          opacity: 1;
        }
        .pcs-active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          right: 0;
          height: 2px;
          background-color: rgba(217,217,217,.72);
        }
        #paon-context-switcher .pcs-divider {
          width: 1px;
          height: 14px;
          background-color: rgba(255,255,255,.18);
        }
      </style>
      <span class="pcs-store pcs-active">Store</span>
      <span class="pcs-divider"></span>
      <a href="/dashboard?returnTo=\${encodeURIComponent(currentPathname)}" class="pcs-mypaon pcs-inactive">My PAON</a>
    \`;

    logoEl.insertAdjacentElement("afterend", switcherEl);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
</script>`;

  const dfrHandoffScript = `<script id="paon-dfr-handoff-inject">
(function() {
  function initDfrModule() {
    const infoCardsFlow = document.getElementById('paon-info-cards-flow');
    if (!infoCardsFlow || document.getElementById('paon-dfr-module')) return;

    const dfrModule = document.createElement('div');
    dfrModule.id = 'paon-dfr-module';
    dfrModule.className = 'paon-dfr-module';
    dfrModule.innerHTML = \`
      <style>
        .paon-dfr-module {
          margin: 24px 0;
          padding: 20px;
          background: linear-gradient(135deg, rgba(220, 227, 214, 0.08), rgba(255, 255, 255, 0.04));
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .paon-dfr-module-heading {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
          line-height: 1.3;
          letter-spacing: 0.01em;
        }
        .paon-dfr-module-steps {
          list-style: none;
          margin: 0 0 20px 0;
          padding: 0;
        }
        .paon-dfr-module-step {
          margin: 0 0 12px 0;
          padding: 0 0 0 24px;
          position: relative;
          font-size: 13px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.75);
        }
        .paon-dfr-module-step::before {
          content: '';
          position: absolute;
          left: 0;
          top: 2px;
          width: 6px;
          height: 6px;
          background: rgba(220, 227, 214, 0.6);
          border-radius: 50%;
        }
        .paon-dfr-module-cta {
          display: inline-block;
          padding: 10px 20px;
          background: #dce3d6;
          color: #182018;
          text-decoration: none;
          border: none;
          border-radius: 15px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 200ms ease;
        }
        .paon-dfr-module-cta:hover {
          background: white;
        }
      </style>
      <div class="paon-dfr-module-heading">Try in Digital Fitting Room</div>
      <ol class="paon-dfr-module-steps">
        <li class="paon-dfr-module-step">Upload two reference photos to create your digital portrait.</li>
        <li class="paon-dfr-module-step">Select this piece and compose it with other items you own or are considering.</li>
        <li class="paon-dfr-module-step">See how the look takes shape before you ask your advisor to make it real.</li>
      </ol>
      <a href="#" class="paon-dfr-module-cta" id="paon-dfr-cta">Start creating</a>
    \`;

    infoCardsFlow.parentNode.insertBefore(dfrModule, infoCardsFlow.nextSibling);
  }

  function updateDfrLink(productSlug) {
    const ctaLink = document.getElementById('paon-dfr-cta');
    if (ctaLink) {
      ctaLink.href = '/digital-fitting-room?productSlug=' + encodeURIComponent(productSlug);
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDfrModule);
    } else {
      initDfrModule();
    }

    // Hook into openDetail to update the DFR link
    const originalOpenDetail = window.openDetail;
    if (typeof originalOpenDetail === 'function' && !originalOpenDetail.__paonDfrBound) {
      window.openDetail = function(id) {
        const result = originalOpenDetail.apply(this, arguments);
        if (typeof products !== 'undefined') {
          const product = products.find(p => String(p.id) === String(id));
          if (product) {
            updateDfrLink(product.id);
          }
        }
        return result;
      };
      window.openDetail.__paonDfrBound = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>`;

  const sidebarIdentityScript = `<script id="paon-sidebar-identity-inject">
(function() {
  var CATEGORY_LABELS = { Pants: "Trousers", Knits: "Knitwear" };
  var categoryNames = __PAON_CATEGORY_NAMES_JSON__;
  var PAON_SLUG_RAW = ${JSON.stringify(slug).replace(/<\/script/gi, "<\\/script")};
  var PAON_RETAILER_NAME_RAW = ${JSON.stringify(retailer.displayName).replace(/<\/script/gi, "<\\/script")};

  // Defense in depth: nothing interpolated below is currently attacker-
  // controlled (slug/retailer name are DB-resolved, category names are a
  // fixed server-side list), but this whole block builds innerHTML by
  // string concatenation — escape everything going in regardless, rather
  // than relying on "not attacker-controlled today" staying true forever.
  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  var PAON_SLUG = esc(PAON_SLUG_RAW);
  var PAON_RETAILER_NAME = esc(PAON_RETAILER_NAME_RAW);

  function render() {
    var asideEl = document.querySelector("aside");
    if (!asideEl || asideEl.dataset.paonIdentityApplied) return;
    asideEl.dataset.paonIdentityApplied = "1";

    asideEl.setAttribute(
      "style",
      "width:250px;background:linear-gradient(to right,#333333,#1a1a1a);" +
      "display:grid;grid-template-rows:60px auto minmax(0,1fr) 210px;" +
      "position:sticky;top:0;height:100vh;min-height:100vh;overflow:hidden;"
    );

    var categoryItems = categoryNames.map(function (name) {
      var label = CATEGORY_LABELS[name] || name;
      return (
        '<a href="#" data-cat="' + esc(name) + '" ' +
        'style="display:flex;align-items:center;height:28px;min-height:28px;' +
        'padding-left:20px;opacity:.76;text-decoration:none;">' +
        '<span style="white-space:nowrap;color:#a6a6a6;font-family:OptimaKlein,serif;' +
        'font-size:13px;line-height:1;">' + esc(label) + '</span></a>'
      );
    }).join("");

    asideEl.innerHTML =
      '<a href="/r/' + PAON_SLUG + '" ' +
      'style="display:flex;align-items:center;justify-content:center;overflow:hidden;' +
      'height:60px;background:linear-gradient(to right,#1a1a1a,#1a1a1a);">' +
      '<span style="font-size:13px;line-height:1;position:relative;top:2px;' +
      'white-space:nowrap;font-family:Aviano,serif;color:#fff;">' +
      PAON_RETAILER_NAME + '</span></a>' +

      '<div style="display:flex;align-items:center;justify-content:center;gap:16px;' +
      'background:linear-gradient(to right,rgba(255,255,255,.045),rgba(255,255,255,0)),' +
      'linear-gradient(to right,#262626,#1d1d1d);padding:14px 25px;">' +
      '<a href="/r/' + PAON_SLUG + '" style="font-family:GTBold3,Arial,sans-serif;' +
      'font-size:7px;text-transform:uppercase;letter-spacing:.04em;color:#d9d9d9;' +
      'opacity:1;text-decoration:none;position:relative;">Store</a>' +
      '<span aria-hidden="true" style="width:1px;height:14px;background:rgba(255,255,255,.18);"></span>' +
      '<a href="/dashboard?returnTo=' + encodeURIComponent(location.pathname + location.search) + '" ' +
      'style="font-family:GTBold3,Arial,sans-serif;font-size:7px;text-transform:uppercase;' +
      'letter-spacing:.04em;color:#8a8a87;opacity:.7;text-decoration:none;">My PAON</a></div>' +

      '<div style="display:flex;flex-direction:column;overflow-y:auto;padding:40px 25px 28px;' +
      'background:linear-gradient(to right,rgba(255,255,255,.043),rgba(255,255,255,0)),' +
      'linear-gradient(to right,#262626,#1d1d1d);">' +
      '<a href="/r/' + PAON_SLUG + '" style="font-family:GTBold3,Arial,sans-serif;' +
      'font-size:7px;line-height:1;color:#b5b5b2;text-transform:uppercase;margin:0 0 20px 0;' +
      'text-decoration:none;">Home</a>' +
      '<p style="font-family:GTBold3,Arial,sans-serif;font-size:7px;line-height:7px;' +
      'color:#b5b5b2;text-transform:uppercase;margin:0 0 10px 0;">Collection</p>' +
      categoryItems +
      '</div>' +

      '<div style="position:relative;display:flex;flex-direction:column;overflow:hidden;' +
      'height:210px;min-height:210px;background:linear-gradient(to right,#333333,#1a1a1a);' +
      'padding:20px 25px 0;">' +
      '<a href="/discover/platform" style="font-family:GTBold3,Arial,sans-serif;font-size:7px;' +
      'line-height:1.4;color:#b5b5b2;text-transform:uppercase;margin-bottom:5px;' +
      'text-decoration:none;">How it works</a>' +
      '<a href="/founder" style="font-family:GTBold3,Arial,sans-serif;font-size:7px;' +
      'line-height:1.4;color:#b5b5b2;text-transform:uppercase;margin-bottom:5px;' +
      'text-decoration:none;">About Us</a>' +
      '<a href="/consultation" style="font-family:GTBold3,Arial,sans-serif;font-size:7px;' +
      'line-height:1.4;color:#b5b5b2;text-transform:uppercase;margin-bottom:5px;' +
      'text-decoration:none;">Contact</a>' +
      '<a href="/appointments" style="position:absolute;bottom:20px;left:20px;right:20px;' +
      'height:50px;border-radius:15px;background:linear-gradient(to right,#999999,#666666);' +
      'color:#d9d9d9;font-family:OptimaKlein,serif;font-size:14px;padding:0 20px;' +
      'display:flex;align-items:center;justify-content:flex-end;text-decoration:none;">' +
      'Book Appointment</a>' +
      '</div>';

    var links = asideEl.querySelectorAll("a[data-cat]");
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener("click", function (e) {
        e.preventDefault();
        var name = this.getAttribute("data-cat");
        if (window.paonReturnHomeFromDetail !== undefined) {
          window.paonReturnHomeFromDetail = false;
        }
        if (typeof window.showCollectionGrid === "function") {
          window.showCollectionGrid(name);
        } else {
          location.href = "/r/" + PAON_SLUG_RAW + "?category=" + encodeURIComponent(name);
        }
      });
    }
  }

  function init() {
    // Run after the template's own DOMContentLoaded render (registered
    // earlier in the document) has finished, so this replacement is the
    // final word, not overwritten by it.
    window.setTimeout(render, 0);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
</script>`;

  const brandHead = [
    logoUrl || heroUrl
      ? `<link rel="preload" as="image" href="${escapeHtml(logoUrl ?? heroUrl!)}"/>`
      : "",
    faviconUrl ? `<link rel="icon" href="${escapeHtml(faviconUrl)}"/>` : "",
    `<link rel="prefetch" as="document" href="/dashboard"/>`,
    `<link rel="prefetch" as="document" href="/login"/>`,
    dfrHandoffScript,
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
/* Stage 21.2 one-platform seam: opt this document into the native
   cross-document view transition shared with the customer dashboard
   (apps/customer/app/globals.css). Both sides must set navigation: auto. */
@view-transition { navigation: auto; }
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 180ms;
  animation-timing-function: ease;
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }
}
</style>`,
    contextSwitcherScript,
    sidebarIdentityScript,
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

  const storyHtml = storyLine
    ? `<div class="paon-story" style="margin:10px 12px 2px;padding:0 0 10px;border-bottom:1px solid color-mix(in srgb, var(--paon-ink) 12%, transparent);">
<p style="margin:0;font-family:var(--font-retailer-display),Georgia,serif;font-size:13px;line-height:1.3;letter-spacing:.01em;color:var(--paon-ink);">${escapeHtml(storyLine)}</p>
</div>`
    : "";

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
    retailerNameRaw: retailer.displayName,
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

  return pageData;
}
