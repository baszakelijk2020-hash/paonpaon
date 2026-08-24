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
 * sidebar. Deliberately flat: no subtabs, max 8 entries. `trailing` holds
 * persona/settings — utility controls, not a 9th tab. It remains a constant
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
      className="sticky top-3 z-40 mx-3 flex h-[60px] w-[calc(100%-1.5rem)] items-stretch divide-x divide-black/10 rounded-2xl border border-white/40 bg-white/10 shadow-[0_10px_35px_rgba(38,34,28,0.08)] backdrop-blur-[20px]"
    >
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 items-center justify-center whitespace-nowrap text-center text-[15px] font-medium tracking-[0.02em] transition-colors duration-200 ${
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
