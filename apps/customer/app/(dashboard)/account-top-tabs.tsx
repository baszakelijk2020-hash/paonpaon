"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface AccountTab {
  href: string;
  label: string;
}

/** The entire account nav lives here now (sticky, full-width, top) instead
 * of a second sidebar — the left sidebar is reserved for shop categories
 * (see shop-category-sidebar.tsx) so the customer only ever learns one
 * sidebar. Deliberately flat: no subtabs, max 8 entries. `trailing` holds
 * persona/settings/sign-out — utility controls, not a 9th tab.
 *
 * Compacts on scroll-down, restores full height on scroll-up. A sticky
 * bar that changes its OWN height on every scroll tick is a feedback
 * loop — shrinking shifts the page's layout, which itself fires more
 * scroll events, which can flip the state back before the transition
 * settles ("vibrating"). Fixed absolute thresholds with a wide dead
 * zone (not a delta compared every tick) and no animated height
 * transition avoid that: the swap is instant, one frame, done. */
export function AccountTopTabs({
  tabs,
  trailing,
}: {
  tabs: AccountTab[];
  trailing?: ReactNode;
}) {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const ticking = useRef(false);

  useEffect(() => {
    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > 160) setCompact(true);
        else if (y < 40) setCompact(false);
        ticking.current = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-label="Account"
      className={`sticky top-0 z-40 flex w-full items-stretch divide-x divide-black/10 border-b border-black/10 bg-white ${compact ? "h-[33px]" : "h-[60px]"}`}
    >
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 whitespace-nowrap text-center font-medium tracking-[0.02em] transition-colors duration-200 ${
              compact ? "py-1.5 text-[11px]" : "py-4 text-[13px]"
            } ${
              active
                ? "bg-[var(--color-stone-900)] text-white"
                : "text-[var(--color-stone-600)] hover:bg-[var(--color-stone-50)] hover:text-[var(--color-stone-900)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
      {trailing ? (
        <div className="flex shrink-0 items-center px-4">{trailing}</div>
      ) : null}
    </nav>
  );
}
