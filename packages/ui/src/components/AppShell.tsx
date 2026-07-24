"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { cn } from "../lib/cn";

export interface AppShellNavItem {
  href: string;
  label: string;
  description?: string;
}

export interface AppShellNavGroup {
  label: string;
  items: AppShellNavItem[];
}

export interface AppShellProps {
  brand: string;
  product: string;
  homeHref: string;
  persona: string;
  email: string;
  navigation: AppShellNavGroup[];
  mobileDock?: AppShellNavItem[];
  signOutControl: ReactNode;
  children: ReactNode;
}

function NavGroups({
  groups,
  onNavigate,
}: {
  groups: AppShellNavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-col gap-8">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[7px] font-[var(--font-accent)] uppercase tracking-[0.16em] text-white/35">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  {...(active ? { "aria-current": "page" as const } : {})}
                  {...(onNavigate ? { onClick: onNavigate } : {})}
                  className={cn(
                    "group relative rounded-[var(--radius-md)] px-3 py-2.5 text-[13px] transition-[background-color,color,transform] duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)]",
                    active
                      ? "bg-white/[0.09] text-white"
                      : "text-white/55 hover:translate-x-0.5 hover:bg-white/[0.04] hover:text-white/85",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-3 left-0 w-px bg-white transition-opacity",
                      active ? "opacity-70" : "opacity-0",
                    )}
                  />
                  <span className="block font-[var(--font-display)]">
                    {item.label}
                  </span>
                  {item.description ? (
                    <span className="mt-0.5 block text-[10px] leading-4 text-white/35">
                      {item.description}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  brand,
  product,
  homeHref,
  persona,
  email,
  navigation,
  mobileDock,
  signOutControl,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--color-stone-50)] text-[var(--color-stone-900)]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 grid-rows-[4.5rem_1fr_auto] overflow-hidden bg-[linear-gradient(110deg,#333_0%,#171716_72%)] text-white lg:grid">
        <Link
          href={homeHref}
          className="flex items-center border-b border-white/10 px-7"
        >
          <span className="text-xl font-[var(--font-display)] tracking-[0.14em]">
            {brand}
          </span>
          <span className="ml-3 border-l border-white/20 pl-3 text-[9px] uppercase tracking-[0.18em] text-white/45">
            {product}
          </span>
        </Link>
        <div className="overflow-y-auto px-4 py-9">
          <NavGroups groups={navigation} />
        </div>
        <div className="border-t border-white/10 bg-black/10 px-7 py-6">
          <p className="text-[7px] font-[var(--font-accent)] uppercase tracking-[0.16em] text-white/35">
            Signed in as
          </p>
          <p className="mt-2 text-sm font-[var(--font-display)] text-white/90">
            {persona}
          </p>
          <p className="mt-1 truncate text-[10px] text-white/40">{email}</p>
          <div className="mt-4 [&_button]:!h-8 [&_button]:!px-0 [&_button]:!text-white/55 hover:[&_button]:!bg-transparent hover:[&_button]:!text-white">
            {signOutControl}
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="glass-panel sticky top-0 z-40 border-b border-black/[0.07]">
          <div className="flex h-16 items-center justify-between px-4 sm:px-7 lg:h-[4.5rem] lg:px-10">
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label="Open navigation"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
                className="flex size-10 items-center justify-center rounded-[var(--radius-md)] border border-black/10 lg:hidden"
              >
                <span className="flex w-4 flex-col gap-1">
                  <span className="h-px w-full bg-current" />
                  <span className="h-px w-full bg-current" />
                  <span className="h-px w-full bg-current" />
                </span>
              </button>
              <div>
                <p className="text-[7px] font-[var(--font-accent)] uppercase tracking-[0.16em] text-[var(--color-stone-500)]">
                  {product}
                </p>
                <p className="text-sm font-[var(--font-display)] text-[var(--color-stone-800)]">
                  {persona}
                </p>
              </div>
            </div>
            <p className="hidden max-w-xs truncate text-xs text-[var(--color-stone-500)] sm:block lg:hidden">
              {email}
            </p>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto w-full max-w-[92rem] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 xl:px-14",
            mobileDock ? "pb-24 md:pb-10" : "",
          )}
        >
          {children}
        </main>
      </div>

      {mobileDock ? (
        <nav
          aria-label="Primary (mobile)"
          className="glass-panel fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-black/10 pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {mobileDock.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                {...(active ? { "aria-current": "page" as const } : {})}
                className={cn(
                  "relative flex min-h-14 items-center justify-center px-1 py-3 text-center text-[10px] transition-colors",
                  active
                    ? "text-[var(--color-stone-950)]"
                    : "text-[var(--color-stone-500)]",
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-5 top-0 h-px bg-[var(--color-stone-900)]"
                  />
                ) : null}
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {menuOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 grid w-[min(86vw,22rem)] grid-rows-[4.5rem_1fr_auto] overflow-hidden bg-[linear-gradient(110deg,#333_0%,#171716_72%)] text-white shadow-[20px_0_60px_rgba(0,0,0,.35)]">
            <div className="flex items-center justify-between border-b border-white/10 px-6">
              <Link
                href={homeHref}
                onClick={() => setMenuOpen(false)}
                className="text-lg font-[var(--font-display)] tracking-[0.14em]"
              >
                {brand}
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex size-10 items-center justify-center text-xl text-white/60"
                aria-label="Close navigation"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-8">
              <NavGroups
                groups={navigation}
                onNavigate={() => setMenuOpen(false)}
              />
            </div>
            <div className="border-t border-white/10 px-6 py-5">
              <p className="text-sm font-[var(--font-display)]">{persona}</p>
              <p className="mt-1 truncate text-[10px] text-white/40">{email}</p>
              <div className="mt-3 [&_button]:!h-8 [&_button]:!px-0 [&_button]:!text-white/55">
                {signOutControl}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
