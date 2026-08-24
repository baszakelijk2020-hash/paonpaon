import {
  CollectionRepository,
  ProductRepository,
  RetailerRepository,
} from "@paon/database";
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

export async function ShopCategorySidebar() {
  const categories = await populatedCategories();
  return (
    <aside
      className="sticky top-0 hidden h-screen min-h-screen grid-rows-[60px_minmax(0,1fr)_200px] overflow-hidden lg:grid"
      style={{
        width: "250px",
        background: "linear-gradient(to right, #262626, #1d1d1d)",
      }}
    >
      <IntentPrefetchLink
        href="/r/atelier-demo"
        className="flex shrink-0 items-center justify-center overflow-hidden"
        style={{
          height: "60px",
          background: "linear-gradient(to right, #333, #1a1a1a)",
          borderRadius: 0,
        }}
      >
        <span
          className="shop-sidebar-shimmer inline-block whitespace-nowrap"
          style={{
            fontFamily: "Aviano, serif",
            fontSize: "19px",
            lineHeight: 1,
          }}
        >
          Nebel &amp; Spiegel
        </span>
      </IntentPrefetchLink>
      <div
        className="flex flex-1 flex-col overflow-y-auto"
        style={{ padding: "62px 25px 28px" }}
      >
        <IntentPrefetchLink
          href="/r/atelier-demo"
          className="block cursor-pointer text-left uppercase opacity-70 transition-colors hover:text-[#a6a6a6] hover:opacity-100"
          style={{
            fontFamily: "GTBold3, Arial, sans-serif",
            fontSize: "7px",
            lineHeight: 1,
            letterSpacing: 0,
            color: "#666666",
            margin: "0 0 20px 0",
          }}
        >
          Home
        </IntentPrefetchLink>
        <p
          className="block uppercase"
          style={{
            fontFamily: "OptimaKlein, serif",
            fontSize: "12px",
            lineHeight: 1.4,
            letterSpacing: 0,
            color: "#808080",
            margin: "0 0 10px 0",
          }}
        >
          Collection
        </p>
        {categories.map((category) => (
          <IntentPrefetchLink
            key={category}
            href={`/r/atelier-demo?category=${encodeURIComponent(category)}`}
            className="group flex items-center opacity-[.48] transition-[opacity,transform] duration-200 hover:translate-x-[3px] hover:opacity-[.86]"
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
              {category}
            </span>
          </IntentPrefetchLink>
        ))}
      </div>
      <div
        className="relative flex shrink-0 flex-col overflow-hidden"
        style={{
          background: "linear-gradient(to right, #333, #1a1a1a)",
          padding: "20px 25px 65px",
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
              color: "#666666",
              marginBottom: "5px",
            }}
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/appointments"
          className="absolute flex items-center no-underline"
          style={{
            bottom: "20px",
            left: "20px",
            right: "20px",
            height: "45px",
            borderRadius: "6px",
            background: "linear-gradient(to right, #808080, #5c5c5c)",
            color: "#b5b5b5",
            fontSize: "13px",
            padding: "0 20px",
            justifyContent: "flex-end",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            style={{ width: 20, height: 20, marginRight: "auto" }}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
          Book Appointment
        </Link>
      </div>
      <style>{`
        @font-face {
          font-family: OptimaKlein;
          src: url('/fonts/optimaklein.woff2') format('woff2');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: Aviano;
          src: url('/fonts/aviano.woff2') format('woff2');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: Portrait;
          src: url('/fonts/aviano.woff2') format('woff2');
          font-display: swap;
        }
        @font-face {
          font-family: GTBold3;
          src: url('/fonts/gtbold3.woff2') format('woff2');
          font-weight: 400;
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
