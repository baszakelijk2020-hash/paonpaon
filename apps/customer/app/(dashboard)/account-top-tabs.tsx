"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

export interface AccountTab {
  href: string;
  label: string;
}

/** The entire account nav lives here now (sticky, full-width, top) instead
 * of a second sidebar — the left sidebar is reserved for shop categories
 * (see shop-category-sidebar.tsx) so the customer only ever learns one
 * sidebar. Deliberately flat: no subtabs, max 7 entries. `trailing` holds
 * profile utilities rather than another primary destination. It remains a constant
 * 60px, matching the storefront logo header exactly; changing a sticky
 * navigation height during scroll makes the shell feel unstable. */
export function AccountTopTabs({
  tabs,
  trailing,
}: {
  tabs: AccountTab[];
  trailing?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Account"
      className="sticky top-3 z-40 mx-3 flex h-[60px] w-[calc(100%-1.5rem)] items-stretch gap-1 rounded-[1.35rem] bg-white/70 p-1 shadow-[0_10px_35px_rgba(38,34,28,0.08)] backdrop-blur-[20px]"
    >
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const mobileSecondary =
          tab.href === "/orders" || tab.href === "/morning-routine";
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`${mobileSecondary ? "hidden sm:flex" : "flex"} flex-1 items-center justify-center rounded-[1rem] px-2 text-center text-[13px] font-medium tracking-[0.015em] transition-colors duration-200 sm:px-3 sm:text-[14px] ${
              active
                ? "bg-[var(--color-stone-900)] text-white"
                : "text-[var(--color-stone-600)] hover:bg-white/80 hover:text-[var(--color-stone-900)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
      {trailing ? (
        <div className="hidden shrink-0 items-center px-2 sm:flex">
          {trailing}
        </div>
      ) : null}
    </nav>
  );
}
