import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { ContextSwitcher } from "./context-switcher";
import { StorefrontCategoryControl } from "./storefront-category-control";

import { CANONICAL_CATEGORIES } from "@/app/(shell)/r/[slug]/canonical-category";
import { getSession } from "@/lib/session";

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

/**
 * The whole collection, always — Shirts, Outerwear, Evening and Wedding are
 * carried with nothing in them yet, and a rail that appears and disappears
 * with the seed reads as the shop being broken rather than the rail being
 * empty. Same list the storefront's own category nav shows
 * (get-storefront-page-data.ts).
 */
const SIDEBAR_CATEGORIES = CANONICAL_CATEGORIES;

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
  const categories = SIDEBAR_CATEGORIES;
  const [storeHref, session] = await Promise.all([
    storeReturnHref(),
    getSession(),
  ]);
  const isSignedIn = session?.accountType === "customer";
  return (
    <aside
      className="sticky top-0 hidden h-screen min-h-screen grid-rows-[60px_auto_minmax(0,1fr)_210px] self-start overflow-hidden lg:grid"
      style={{
        width: "250px",
        background: "linear-gradient(to right, #333333, #1a1a1a)",
      }}
    >
      <StorefrontCategoryControl
        baseHref="/r/atelier-demo"
        category={null}
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
      </StorefrontCategoryControl>
      <ContextSwitcher storeHref={storeHref} />
      <div
        className="flex flex-1 flex-col overflow-y-auto"
        style={{
          padding: "40px 25px 28px",
          background:
            "linear-gradient(to right, rgba(255,255,255,.043), rgba(255,255,255,0)), linear-gradient(to right, #262626, #1d1d1d)",
        }}
      >
        <StorefrontCategoryControl
          baseHref="/r/atelier-demo"
          category={null}
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
        </StorefrontCategoryControl>
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
          <StorefrontCategoryControl
            key={category}
            baseHref="/r/atelier-demo"
            category={category}
            className="group flex items-center opacity-[.76] transition-transform duration-200 hover:translate-x-[3px] hover:opacity-100 data-[active=true]:opacity-100"
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
          </StorefrontCategoryControl>
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
        {isSignedIn ? null : (
          <div
            className="absolute left-5 right-5 flex items-center justify-between gap-3"
            style={{ bottom: "20px" }}
          >
            <p
              className="m-0"
              style={{
                fontFamily: "OptimaKlein, serif",
                fontSize: "11px",
                lineHeight: 1.35,
                color: "#8f8f8c",
              }}
            >
              Log in to see your pieces, fittings and invitations.
            </p>
            <Link
              href="/login"
              className="shrink-0 border border-white/20 bg-white/[0.07] no-underline transition-colors hover:bg-white/[0.14]"
              style={{
                padding: "7px 18px",
                borderRadius: "999px",
                fontFamily: "GTBold3, Arial, sans-serif",
                fontSize: "7px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                lineHeight: 1,
                color: "#e4e4e1",
              }}
            >
              Log in
            </Link>
          </div>
        )}
        <Link
          href="/appointments"
          className="absolute flex items-center no-underline"
          style={{
            // Clear of the sign-in row when there is one; the row is the
            // bottom-most thing in the sidebar and this sits above it.
            bottom: isSignedIn ? "20px" : "82px",
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
