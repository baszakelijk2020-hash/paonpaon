/* eslint-disable @next/next/no-img-element -- remote artwork tinted with
   filter(); next/image adds nothing for these and cannot optimise them. */
import { cookies } from "next/headers";

import { ContextSwitcher } from "./context-switcher";
import { GuestSignInButton } from "./guest-sign-in-button";
import { SidebarAccountNav, type AccountNavItem } from "./sidebar-account-nav";
import { SidebarEnvironmentNav } from "./sidebar-environment-nav";
import { SidebarLink } from "./sidebar-link";
import { CategoryList, SidebarReveal } from "./sidebar-reveal";
import { StoreVisitCard } from "./store-visit-card";
import { StorefrontCategoryControl } from "./storefront-category-control";

import { CANONICAL_CATEGORIES } from "@/app/(shell)/r/[slug]/canonical-category";
import { getSession } from "@/lib/session";

import "./sidebar.css";

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

/**
 * The customer environment's seven destinations — what used to be the bar
 * across the top of every account page. Every prior sub-page still exists at
 * its own URL and is linked from its section's landing page.
 */
const ACCOUNT_NAV: AccountNavItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/appointments", label: "Appointments" },
  { href: "/orders", label: "Orders" },
  { href: "/loyalty", label: "Rewards" },
  { href: "/account", label: "Profile" },
];

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

  // Tiny sidebar marks. 8px so they read as bullets beside the 7px GTBold3 labels
  // instead of competing with them, and painted from currentColor so each one inherits
  // its row's colour and hover state. Called as a function rather than rendered as a
  // <NavIcon/> component so it has no component identity to remount on each render.
  // Every icon renders into an identical 19px box so their centres line up in the
  // column. Apparent glyph size is tuned with the viewBox, never the box size — a
  // narrower box would shift that glyph's centre relative to its neighbours.
  // `inset` shrinks the artwork WITHOUT shrinking the box: a smaller box would move the
  // glyph's centre off the shared column, which is what misaligned these icons before.
  const navIcon = (
    d: string,
    viewBox = "0 0 24 24",
    _size = 19,
    inset = 0,
    rotate = 0,
  ) =>
    d.startsWith("http") ? (
      // Raster marks cannot take currentColor, so they are tinted instead. Both source
      // PNGs are pure white, and 181/255 = .71 is the same #b5b5b2 the vector glyphs
      // inherit — so the whole row stays one colour.
      <img
        src={d}
        alt=""
        aria-hidden="true"
        style={{
          objectFit: "contain",
          boxSizing: "border-box",
          padding: `${inset}px`,
          transform: rotate ? `rotate(${rotate}deg)` : undefined,
        }}
      />
    ) : (
      <svg aria-hidden="true" viewBox={viewBox}>
        <path d={d} fillRule="evenodd" clipRule="evenodd" />
      </svg>
    );
  const ICON_HOME =
    "M12 2.75 2.75 10.4h2.2v10.85h5.05v-6.1h4v6.1h5.05V10.4h2.2L12 2.75Z";
  const ICON_COLLECTION =
    "M3 3h7.5v7.5H3V3Zm10.5 0H21v7.5h-7.5V3ZM3 13.5h7.5V21H3v-7.5Zm10.5 0H21V21h-7.5v-7.5Z";
  const ICON_LOCATIONS =
    "M12 2.25c-3.5 0-6.25 2.7-6.25 6.1 0 4.4 5.35 12.1 5.6 12.45a.8.8 0 0 0 1.3 0c.25-.35 5.6-8.05 5.6-12.45 0-3.4-2.75-6.1-6.25-6.1Zm0 8.6a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Z";
  const ICON_HOW_IT_WORKS = "https://www.nebelspiegel.com/images/book100.png";
  const ICON_ABOUT_US = "https://www.nebelspiegel.com/images/by1000.png";
  const ICON_CONTACT = "https://www.nebelspiegel.com/images/mail100.png";

  return (
    <aside
      className="paon-side sticky top-0 hidden h-screen min-h-screen flex-col self-start overflow-hidden lg:flex"
      style={{
        width: "250px",
        // Top to bottom, 90% black (#1a1a1a) to 70% black (#4d4d4d).
        background: "linear-gradient(to bottom, #1a1a1a, #4d4d4d)",
      }}
    >
      <StorefrontCategoryControl
        baseHref="/r/atelier-demo"
        category={null}
        className="paon-side-hover flex shrink-0 items-center justify-center overflow-hidden"
        style={{
          height: "60px",
          background: "transparent",
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
        className="flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-width:none]"
        style={{
          padding: "26px 25px 16px",
          background: "transparent",
        }}
      >
        <SidebarEnvironmentNav
          account={
            <SidebarReveal key="customer" environment="customer">
              <SidebarAccountNav items={ACCOUNT_NAV} />
            </SidebarReveal>
          }
          store={
            <SidebarReveal key="store" environment="store">
              <StorefrontCategoryControl
                baseHref="/r/atelier-demo"
                category={null}
                className="paon-side-row"
              >
                {/* Tighter viewBox, not a bigger box: the house fills more of the shared 19px
              square, so it reads ~3px larger while its centre stays on the column. */}
                {navIcon(ICON_HOME, "2 2 20 20")}
                Home
              </StorefrontCategoryControl>
              {/* Collection opens the first category, so the header is a
                  control like the rows beneath it. */}
              <StorefrontCategoryControl
                baseHref="/r/atelier-demo"
                category={categories[0] ?? null}
                className="paon-side-row paon-side-collection"
              >
                {navIcon(ICON_COLLECTION)}
                Collection
              </StorefrontCategoryControl>
              {/* The rule is a sibling of the rows, absolutely positioned, so it spans exactly
            from the first category to the last without needing a hardcoded height. */}
              <CategoryList>
                {categories.map((category) => (
                  <StorefrontCategoryControl
                    key={category}
                    baseHref="/r/atelier-demo"
                    category={category}
                    className="paon-side-category"
                  >
                    {SIDEBAR_CATEGORY_LABELS[category] ?? category}
                  </StorefrontCategoryControl>
                ))}
              </CategoryList>
            </SidebarReveal>
          }
        />
      </div>
      <div className="flex shrink-0 flex-col">
        <nav
          className="paon-side-footer flex flex-col px-[25px] pb-[48px] pt-[14px]"
          aria-label="Storefront information"
        >
          {[
            {
              href: "/r/atelier-demo/locations",
              label: "Locations",
              icon: ICON_LOCATIONS,
              // The pin only spans ~12.5 of a 24 viewBox, where the other glyphs span
              // ~18, so at a shared viewBox it rendered visibly smaller. A tighter box
              // scales it up to match them.
              // Square box centred on the pin (x 5.75-18.25, y 2.25-20.8), tight enough
              // that the pin fills the 19px square like the enlarged house does.
              viewBox: "2 1.5 20 20",
              inset: 0,
              rotate: 0,
            },
            {
              href: "/discover/platform",
              label: "How it works",
              icon: ICON_HOW_IT_WORKS,
              viewBox: "0 0 24 24",
              // 3px smaller than the 19px box, inset so the centre does not move.
              inset: 1.5,
              rotate: 0,
            },
            {
              href: "/founder",
              label: "About Us",
              icon: ICON_ABOUT_US,
              viewBox: "0 0 24 24",
              inset: 0,
              rotate: 0,
            },
            {
              href: "/consultation",
              label: "Contact",
              icon: ICON_CONTACT,
              viewBox: "0 0 24 24",
              // 2px smaller than the 19px box.
              inset: 1,
              rotate: 0,
            },
          ].map((link) => (
            <SidebarLink
              key={link.href}
              href={link.href}
              className="paon-side-row"
            >
              {navIcon(link.icon, link.viewBox, 19, link.inset, link.rotate)}
              {link.label}
            </SidebarLink>
          ))}
        </nav>
        <div className="flex flex-col gap-[10px] px-[20px] pb-[20px]">
          <StoreVisitCard storeHref={storeHref} />
          {isSignedIn ? null : (
            <GuestSignInButton
              className="paon-side-hover paon-sidebar-signin flex items-center justify-between no-underline transition-colors duration-[400ms] ease-out hover:bg-white/[0.1]"
              style={{
                // Same footprint as the TableService pill: 48px tall, full pill.
                height: "48px",
                borderRadius: "999px",
                background:
                  "linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.055))",
                color: "#e4e4e1",
                fontSize: "14px",
                letterSpacing: "-0.01em",
                padding: "0 20px",
              }}
            >
              Sign in
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{
                  flexShrink: 0,
                  opacity: 0.85,
                  position: "relative",
                  left: "3.6px",
                }}
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </GuestSignInButton>
          )}
        </div>
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
