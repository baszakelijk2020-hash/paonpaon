"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type PointerEvent, type ReactNode, useEffect, useState } from "react";

export interface AccountTab {
  href: string;
  label: string;
}

function markOptimisticTab(
  event: PointerEvent<HTMLAnchorElement>,
  href: string,
): void {
  const nav = event.currentTarget.closest("nav");
  if (!nav) return;
  for (const link of nav.querySelectorAll<HTMLElement>(
    "[data-customer-top-menu]",
  )) {
    link.dataset["optimisticActive"] = String(
      link.dataset["customerTabHref"] === href,
    );
  }
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
  const router = useRouter();
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  useEffect(() => {
    setOptimisticHref(null);
    for (const link of document.querySelectorAll<HTMLElement>(
      "[data-customer-top-menu]",
    )) {
      delete link.dataset["optimisticActive"];
    }
  }, [pathname]);
  useEffect(() => {
    for (const tab of tabs) router.prefetch(tab.href);
  }, [router, tabs]);
  const mobilePrimaryTabs = tabs.slice(0, 3);
  const mobileOverflowTabs = [
    ...tabs.slice(3),
    ...(tabs.some((tab) => tab.href === "/account")
      ? []
      : [{ href: "/account", label: "My Profile" }]),
  ];

  return (
    <nav
      aria-label="Account"
      className="sticky top-0 z-40 flex h-[60px] w-full items-stretch border-b border-[var(--customer-border)] bg-[rgba(244,242,237,0.92)] backdrop-blur-md"
    >
      {tabs.map((tab, index) => {
        const activePath = optimisticHref ?? pathname;
        const active =
          activePath === tab.href || activePath.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            data-customer-top-menu
            data-customer-tab-href={tab.href}
            onPointerDown={(event) => {
              markOptimisticTab(event, tab.href);
              setOptimisticHref(tab.href);
            }}
            onClick={() => setOptimisticHref(tab.href)}
            aria-current={active ? "page" : undefined}
            className={`${index < mobilePrimaryTabs.length ? "flex" : "hidden sm:flex"} flex-1 items-center justify-center border-r border-black/10 px-2 text-center text-[12px] font-medium tracking-[0.01em] data-[optimistic-active=false]:!bg-transparent data-[optimistic-active=true]:!bg-[var(--customer-moss)] data-[optimistic-active=false]:!text-[var(--color-stone-600)] data-[optimistic-active=true]:!text-[var(--customer-ink)] sm:px-3 sm:text-[13px] ${
              active
                ? "bg-[var(--customer-moss)] text-[var(--customer-ink)]"
                : "text-[var(--color-stone-600)] hover:bg-white/60 hover:text-[var(--customer-ink)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
      {mobileOverflowTabs.length > 0 ? (
        <div className="relative flex flex-1 sm:hidden">
          <button
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="customer-mobile-navigation"
            onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
            className={`flex w-full items-center justify-center border-r border-black/10 px-2 text-center text-[12px] font-medium tracking-[0.01em] transition-colors duration-200 ${
              mobileOverflowTabs.some(
                (tab) =>
                  (optimisticHref ?? pathname) === tab.href ||
                  (optimisticHref ?? pathname).startsWith(`${tab.href}/`),
              )
                ? "bg-[var(--customer-moss)] text-[var(--customer-ink)]"
                : "text-[var(--color-stone-600)] hover:bg-white/60 hover:text-[var(--customer-ink)]"
            }`}
          >
            More
          </button>
          {isMobileMenuOpen ? (
            <div
              id="customer-mobile-navigation"
              className="absolute right-2 top-[calc(100%+8px)] z-50 w-[min(19rem,calc(100vw-1rem))] overflow-hidden rounded-[15px] bg-[var(--customer-ink)] p-1.5 shadow-[0_18px_45px_rgba(21,31,25,0.24)]"
            >
              {mobileOverflowTabs.map((tab) => {
                const activePath = optimisticHref ?? pathname;
                const active =
                  activePath === tab.href ||
                  activePath.startsWith(`${tab.href}/`);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    prefetch
                    data-customer-top-menu
                    data-customer-tab-href={tab.href}
                    aria-current={active ? "page" : undefined}
                    onPointerDown={(event) => {
                      markOptimisticTab(event, tab.href);
                      setOptimisticHref(tab.href);
                    }}
                    onClick={() => {
                      setOptimisticHref(tab.href);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex min-h-12 items-center rounded-[11px] px-4 text-[14px] font-medium ${
                      active
                        ? "bg-[var(--customer-moss)] text-[var(--customer-ink)]"
                        : "text-[var(--color-paper)] hover:bg-white/10"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      {trailing ? (
        <div className="hidden min-w-[110px] shrink-0 items-stretch sm:flex">
          {trailing}
        </div>
      ) : null}
    </nav>
  );
}
