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
      className="sticky top-0 z-40 flex h-[60px] w-full items-stretch gap-1 border-b border-[var(--customer-border)] bg-[rgba(244,242,237,0.88)] px-1 backdrop-blur-md"
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
            className={`${mobileSecondary ? "hidden sm:flex" : "flex"} flex-1 items-center justify-center rounded-[var(--customer-radius)] px-2 text-center text-[13px] font-medium tracking-[0.015em] transition-colors duration-200 sm:px-3 sm:text-[14px] ${
              active
                ? "bg-[var(--customer-moss)] text-[var(--customer-ink)]"
                : "text-[var(--color-stone-600)] hover:bg-white/60 hover:text-[var(--customer-ink)]"
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
