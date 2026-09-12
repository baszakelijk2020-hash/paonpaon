"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

/**
 * The customer environment's own navigation, in the shared left sidebar.
 *
 * These are the seven destinations that used to sit in a bar across the top of
 * every account page. The sidebar is the app's one navigation surface now, so
 * each environment fills it with its own items: the storefront keeps Home /
 * Collection / categories, the wardrobe gets this.
 *
 * Rows share the storefront sidebar's own type scale (sidebar.css) rather
 * than the account palette, so both environments read as one sidebar.
 */

export interface AccountNavItem {
  href: string;
  label: string;
}

const ICONS: Record<string, ReactNode> = {
  "/dashboard": (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  "/wardrobe": (
    <path d="M9 6a3 3 0 1 1 5 2c-1 1-2 1-2 3l9 6a1.5 1.5 0 0 1-1 3H4a1.5 1.5 0 0 1-1-3l9-6" />
  ),
  "/appointments": (
    <>
      <rect x="3" y="5" width="18" height="16" rx="4" />
      <path d="M7 3v4m10-4v4M3 11h18m-13 5h3" />
    </>
  ),
  "/orders": (
    <path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4" />
  ),
  "/digital-fitting-room": (
    <>
      <rect x="6" y="2" width="12" height="18" rx="6" />
      <path d="M9 23h6m-3-3v3m-3-15 5-3m-5 7 6-4" />
    </>
  ),
  "/loyalty": (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
  ),
  "/account": (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
};

/** /hub renders several tabs at one URL, so the active row comes from ?tab. */
function currentPath(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return window.location.pathname === "/hub"
    ? `/${new URLSearchParams(window.location.search).get("tab") ?? "dashboard"}`
    : window.location.pathname;
}

export function SidebarAccountNav({ items }: { items: AccountNavItem[] }) {
  const pathname = usePathname();
  const [activePath, setActivePath] = useState(
    pathname === "/hub" ? "/dashboard" : pathname,
  );

  useEffect(() => {
    const sync = () => setActivePath(currentPath(pathname));
    sync();
    window.addEventListener("paon:customer-tab", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("paon:customer-tab", sync);
      window.removeEventListener("popstate", sync);
    };
  }, [pathname]);

  // The Store / Wardrobe switch changes environment without navigating, so a
  // customer who entered on a storefront URL is looking at the wardrobe while
  // the path still reads /r/[slug]. Nothing would match, and no icon would
  // light; the wardrobe opens on the overview, so that is what is lit.
  const matches = (href: string, path: string) =>
    path === href || path.startsWith(`${href}/`);
  const litPath = items.some((item) => matches(item.href, activePath))
    ? activePath
    : "/dashboard";

  return (
    <nav aria-label="Account" className="paon-sidebar-nav">
      {items.map((item) => {
        const active = matches(item.href, litPath);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            data-customer-top-menu
            data-customer-tab-href={item.href}
            aria-current={active ? "page" : undefined}
            data-active={active ? "true" : "false"}
            className="paon-side-row"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[item.href]}
            </svg>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
