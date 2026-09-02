import {
  CollectionRepository,
  ProductRepository,
  RetailerRepository,
} from "@paon/database";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { IntentPrefetchLink } from "./intent-prefetch-link";

import {
  CANONICAL_CATEGORIES,
  canonicalCategoryFor,
} from "@/app/r/[slug]/canonical-category";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Pixel match of the storefront's own left sidebar, not an approximation —
 * every value below (sidebar width 250px not 256px, header 60px not
 * 4.5rem, .cat-grid padding 62px/25px/28px, .cat-item height 28px with
 * 20px left padding, the 7px GTBold3 Home/Collection labels, the 13px
 * OptimaKlein category labels) is read directly from paon-template.html's
 * own LAST-in-cascade, all-!important override blocks (`#collection-
 * sidebar-final-override`, `#paon-sidebar-home-collection-spacing-final`,
 * the trailing `.sidebar-footer a` block) — the ones later CSS in that
 * file doesn't re-override, i.e. what actually wins and renders. The three
 * @font-face families are the exact same webfont files, loaded from this
 * same Next.js app's own same-origin route (apps/customer/app/fonts/
 * [filename]/route.ts), not a fallback system font.
 */
/**
 * The customer environment's canonical garment taxonomy uses "Trousers" and
 * "Knitwear" (CUSTOMER_ENVIRONMENT_REBUILD_V3 §5.2 / audit F10). The
 * storefront's canonical category values ("Pants", "Knits") stay unchanged so
 * catalogue filtering and the storefront template keep matching — only the
 * label shown in this shared sidebar is aligned.
 */
const SIDEBAR_CATEGORY_LABELS: Partial<
  Record<(typeof CANONICAL_CATEGORIES)[number], string>
> = {
  Pants: "Trousers",
  Knits: "Knitwear",
};

async function populatedCategories(): Promise<
  readonly (typeof CANONICAL_CATEGORIES)[number][]
> {
  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findBySlug(
    "atelier-demo",
  );
  if (!retailer) return [];
  const [products, collections] = await Promise.all([
    new ProductRepository(supabase).findByRetailer(retailer.id),
    new CollectionRepository(supabase).findByRetailer(retailer.id),
  ]);
  const collectionNameById = new Map(
    collections.map((collection) => [collection.id, collection.name]),
  );
  const present = new Set(
    products.map((product) => {
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
  return CANONICAL_CATEGORIES.filter((category) => present.has(category));
}

/** Same open-redirect guard as `store-return-capture.tsx`'s client-side
 * validation — the cookie is trusted only if it still matches on read. */
const VALID_STORE_RETURN = /^\/r\/[A-Za-z0-9_-]+(?:[/?].*)?$/;

async function storeReturnHref(): Promise<string> {
  const cookieStore = await cookies();
  const value = cookieStore.get("paon_storefront_return")?.value;
  if (!value) return "/r/atelier-demo";
  const decoded = decodeURIComponent(value);
  return VALID_STORE_RETURN.test(decoded) ? decoded : "/r/atelier-demo";
}

export async function ShopCategorySidebar() {
  const categories = await populatedCategories();
  const storeHref = await storeReturnHref();
  return (
    <aside
      className="sticky top-0 hidden h-screen min-h-screen grid-rows-[60px_auto_minmax(0,1fr)_210px] self-start overflow-hidden lg:grid"
      style={{
        width: "250px",
        background: "linear-gradient(to right, #333333, #1a1a1a)",
      }}
    >
      <IntentPrefetchLink
        href="/r/atelier-demo"
        className="flex shrink-0 items-center justify-center overflow-hidden"
        style={{
          height: "60px",
          background: "linear-gradient(to right, #1a1a1a, #1a1a1a)",
          borderRadius: 0,
        }}
      >
        <span
          className="shop-sidebar-shimmer font-brand relative top-[2px] inline-block whitespace-nowrap"
          style={{
            fontSize: "13px",
            lineHeight: 1,
          }}
        >
          Nebel &amp; Spiegel
        </span>
      </IntentPrefetchLink>
      <div
        id="paon-context-switcher"
        className="paon-context-switcher flex shrink-0 items-center justify-center"
        style={{
          gap: "16px",
          background:
            "linear-gradient(to right, rgba(255,255,255,.045), rgba(255,255,255,0)), linear-gradient(to right, #262626, #1d1d1d)",
          padding: "14px 25px",
        }}
      >
        <IntentPrefetchLink
          href={storeHref}
          className="pcs-store pcs-inactive"
          style={{
            fontFamily: "GTBold3, Arial, sans-serif",
            fontSize: "7px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "#8a8a87",
            opacity: 0.7,
            textDecoration: "none",
          }}
        >
          Store
        </IntentPrefetchLink>
        <span
          aria-hidden="true"
          style={{
            width: "1px",
            height: "14px",
            background: "rgba(255,255,255,.18)",
          }}
        />
        <span
          className="pcs-mypaon pcs-active"
          style={{
            position: "relative",
            fontFamily: "GTBold3, Arial, sans-serif",
            fontSize: "7px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "#d9d9d9",
            opacity: 1,
          }}
        >
          My PAON
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "-4px",
              left: 0,
              right: 0,
              height: "2px",
              background: "rgba(217,217,217,.72)",
            }}
          />
        </span>
      </div>
      <div
        className="flex flex-1 flex-col overflow-y-auto"
        style={{
          padding: "40px 25px 28px",
          background:
            "linear-gradient(to right, rgba(255,255,255,.043), rgba(255,255,255,0)), linear-gradient(to right, #262626, #1d1d1d)",
        }}
      >
        <IntentPrefetchLink
          href="/r/atelier-demo"
          className="block cursor-pointer text-left uppercase transition-colors hover:text-white"
          style={{
            fontFamily: "GTBold3, Arial, sans-serif",
            fontSize: "7px",
            lineHeight: 1,
            letterSpacing: 0,
            color: "#b5b5b2",
            margin: "0 0 20px 0",
          }}
        >
          Home
        </IntentPrefetchLink>
        <p
          className="block uppercase"
          style={{
            fontFamily: "GTBold3, Arial, sans-serif",
            fontSize: "7px",
            lineHeight: "7px",
            letterSpacing: 0,
            color: "#b5b5b2",
            margin: "0 0 10px 0",
          }}
        >
          Collection
        </p>
        {categories.map((category) => (
          <IntentPrefetchLink
            key={category}
            href={`/r/atelier-demo?category=${encodeURIComponent(category)}`}
            className="group flex items-center opacity-[.76] transition-[opacity,transform] duration-200 hover:translate-x-[3px] hover:opacity-100"
            style={{ height: "28px", minHeight: "28px", paddingLeft: "20px" }}
          >
            <span
              className="whitespace-nowrap text-[#a6a6a6] group-hover:text-[#d9d9d9]"
              style={{
                fontFamily: "OptimaKlein, serif",
                fontSize: "13px",
                lineHeight: 1,
              }}
            >
              {SIDEBAR_CATEGORY_LABELS[category] ?? category}
            </span>
          </IntentPrefetchLink>
        ))}
      </div>
      <div
        className="relative flex shrink-0 flex-col overflow-hidden"
        style={{
          background: "linear-gradient(to right, #333333, #1a1a1a)",
          padding: "20px 25px 0",
        }}
      >
        {[
          { href: "/discover/platform", label: "How it works" },
          { href: "/founder", label: "About Us" },
          { href: "/consultation", label: "Contact" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="uppercase no-underline"
            style={{
              fontFamily: "GTBold3, Arial, sans-serif",
              fontSize: "7px",
              lineHeight: 1.4,
              letterSpacing: 0,
              color: "#b5b5b2",
              marginBottom: "5px",
            }}
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/concierge"
          className="absolute left-5 right-5 flex h-11 items-center justify-between border border-white/15 bg-white/[0.06] px-4 text-[13px] text-[#d9d9d9] no-underline"
          style={{
            bottom: "82px",
            borderRadius: "15px",
            fontFamily: "TN Web Use Only, sans-serif",
          }}
        >
          <span>TableService</span>
          <span aria-hidden="true">→</span>
        </Link>
        <Link
          href="/appointments"
          className="absolute flex items-center no-underline"
          style={{
            bottom: "20px",
            left: "20px",
            right: "20px",
            height: "50px",
            borderRadius: "15px",
            background: "linear-gradient(to right, #999999, #666666)",
            color: "#d9d9d9",
            fontFamily: "OptimaKlein, serif",
            fontSize: "14px",
            padding: "0 20px",
            justifyContent: "flex-end",
          }}
        >
          <Image
            src="https://www.nebelspiegel.com/images/calendar10.png"
            alt=""
            aria-hidden="true"
            width={20}
            height={20}
            unoptimized
            style={{
              width: 20,
              height: 20,
              objectFit: "contain",
              display: "block",
              flexShrink: 0,
              marginRight: "auto",
              opacity: 0.75,
              position: "relative",
              top: -1,
            }}
          />
          Book Appointment
        </Link>
      </div>
      <style>{`
        @font-face {
          font-family: OptimaKlein;
          src: url('/fonts/TN_Web_Use_Only_2.woff2') format('woff2');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: Portrait;
          src: url('/fonts/Munged-MZgX5NxJBs.woff2') format('woff2');
          font-display: swap;
        }
        @font-face {
          font-family: GTBold3;
          src: url('/fonts/gtbold3.woff2') format('woff2');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        @keyframes shop-sidebar-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .shop-sidebar-shimmer {
          background: linear-gradient(90deg, #404040, white, #404040);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shop-sidebar-shimmer 8s linear infinite;
        }
      `}</style>
    </aside>
  );
}
