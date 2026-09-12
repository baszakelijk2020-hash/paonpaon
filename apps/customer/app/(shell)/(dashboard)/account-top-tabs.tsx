"use client";

import gsap from "gsap";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface AccountTab {
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
    <>
      <path d="M9 6a3 3 0 1 1 5 2c-1 1-2 1-2 3l9 6a1.5 1.5 0 0 1-1 3H4a1.5 1.5 0 0 1-1-3l9-6" />
    </>
  ),
  "/appointments": (
    <>
      <rect x="3" y="5" width="18" height="16" rx="4" />
      <path d="M7 3v4m10-4v4M3 11h18m-13 5h3" />
    </>
  ),
  "/orders": (
    <>
      <path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4" />
    </>
  ),
  "/digital-fitting-room": (
    <>
      <rect x="6" y="2" width="12" height="18" rx="6" />
      <path d="M9 23h6m-3-3v3m-3-15 5-3m-5 7 6-4" />
    </>
  ),
  "/loyalty": (
    <>
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    </>
  ),
  "/account": (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
};
function currentPath(fallback: string) {
  if (typeof window === "undefined") return fallback;
  return window.location.pathname === "/hub"
    ? `/${new URLSearchParams(window.location.search).get("tab") ?? "dashboard"}`
    : window.location.pathname;
}

export function AccountTopTabs({
  tabs,
  trailing,
}: {
  tabs: AccountTab[];
  trailing?: ReactNode;
}) {
  const pathname = usePathname();
  const [activePath, setActivePath] = useState(
    pathname === "/hub" ? "/dashboard" : pathname,
  );
  const rail = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const initialized = useRef(false);
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
  useLayoutEffect(() => {
    const update = () => {
      const active = rail.current?.querySelector<HTMLElement>(
        '[aria-current="page"]',
      );
      if (!active || !indicator.current || !rail.current) return;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      gsap.to(indicator.current, {
        x: active.offsetLeft,
        width: active.offsetWidth,
        opacity: 1,
        duration: initialized.current && !reduced ? 0.48 : 0,
        ease: "power4.out",
        overwrite: true,
      });
      const viewport = rail.current.parentElement;
      if (viewport) {
        const left =
          active.offsetLeft - (viewport.clientWidth - active.offsetWidth) / 2;
        gsap.to(viewport, {
          scrollLeft: Math.max(0, left),
          duration: reduced ? 0 : 0.4,
          ease: "power3.out",
          overwrite: true,
        });
      }
      initialized.current = true;
    };
    update();
    const observer = new ResizeObserver(update);
    if (rail.current) observer.observe(rail.current);
    const pill = indicator.current;
    return () => {
      observer.disconnect();
      if (pill) gsap.killTweensOf(pill);
    };
  }, [activePath]);
  return (
    <header className="pe-navigation">
      <nav aria-label="Account" className="pe-navigation-scroll">
        <div ref={rail} className="pe-navigation-rail">
          <span
            ref={indicator}
            className="pe-navigation-indicator"
            aria-hidden="true"
          />
          {tabs.map((tab) => {
            const active =
              activePath === tab.href || activePath.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={false}
                data-customer-top-menu
                data-customer-tab-href={tab.href}
                aria-current={active ? "page" : undefined}
                className="pe-navigation-link"
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
                  {ICONS[tab.href]}
                </svg>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      {trailing && <div className="pe-navigation-utility">{trailing}</div>}
    </header>
  );
}
