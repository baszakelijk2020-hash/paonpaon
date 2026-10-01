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
  /** Explains a shortened or non-obvious persona label (e.g. `sales_associate` displays as "Sales advisor") — rendered as a `title` attribute on the persona text. */
  personaTitle?: string;
  email: string;
  navigation: AppShellNavGroup[];
  mobileDock?: AppShellNavItem[];
  signOutControl: ReactNode;
  signOutControlMobile?: ReactNode;
  children: ReactNode;
}

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function activeGroupFor(
  groups: AppShellNavGroup[],
  pathname: string,
): AppShellNavGroup | undefined {
  return groups.find((group) =>
    group.items.some((item) => isItemActive(pathname, item.href)),
  );
}

/** Left sidebar shows only the topic/category level — a group's own items
 * are subdivided into the sticky horizontal SubTabs bar above the page
 * body instead, so the sidebar stays short no matter how many pages a
 * group grows to contain. */
function SidebarGroups({
  groups,
  onNavigate,
}: {
  groups: AppShellNavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activeGroup = activeGroupFor(groups, pathname);

  return (
    <nav aria-label="Primary" className="flex flex-col gap-px">
      {groups.map((group) => {
        const active = group.label === activeGroup?.label;
        const target = group.items[0]?.href ?? "#";
        return (
          <Link
            key={group.label}
            href={target}
            {...(active ? { "aria-current": "page" as const } : {})}
            {...(onNavigate ? { onClick: onNavigate } : {})}
            className={cn(
              // Customer-environment sidebar row: 26px tall, 12px/500 at
              // negative tracking, 8px gap to its mark. Hover changes colour
              // and lights the icon; it never moves the row.
              "group relative flex min-h-[26px] items-center gap-2 pl-2.5 pr-3 text-[12px] font-medium leading-none tracking-[-0.01em] transition-[color,opacity] duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] [&_svg]:transition-[filter,color] [&_svg]:duration-[var(--duration-quiet)]",
              active
                ? "text-white opacity-100 [&_svg]:[filter:drop-shadow(0_0_4px_rgba(255,255,255,.9))_drop-shadow(0_0_12px_rgba(255,255,255,.55))]"
                : "text-[#b5b5b2] opacity-[0.86] hover:text-white hover:opacity-100 hover:[&_svg]:[filter:drop-shadow(0_0_4px_rgba(255,255,255,.55))]",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-0 top-1/2 h-px -translate-y-1/2 bg-[rgba(217,217,217,0.72)] transition-all",
                active ? "w-3 opacity-100" : "w-0 opacity-0",
              )}
            />
            <NavIcon label={group.label} />
            {group.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * One mark per sidebar group, in the customer environment's own convention:
 * a 19px box, `viewBox="0 0 24 24"`, outline paths on `currentColor` at
 * stroke-width 1.65, so each icon inherits its row's colour and hover glow.
 * The box never resizes, which is what keeps every icon centred on one column.
 *
 * Keyed by group label with a neutral fallback, so a new group added by an app
 * still renders a row rather than a gap.
 */
const NAV_ICON_PATHS: Record<string, string> = {
  Today:
    "M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5-1.4 1.4M7.9 16.1l-1.4 1.4m0-11.9 1.4 1.4m8.2 8.2 1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  "Fitting room":
    "M9 6a3 3 0 1 1 5 2c-1 1-2 1-2 3l9 6a1.5 1.5 0 0 1-1 3H4a1.5 1.5 0 0 1-1-3l9-6",
  Relationships:
    "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1m7-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 9v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  Merchandise: "M4 8h16l-1 12H5L4 8Zm4 0V6a4 4 0 0 1 8 0v2",
  Atelier: "M4 20V9l8-5 8 5v11M9 20v-6h6v6M4 20h16",
  Appointments:
    "M8 3v3m8-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  Orders: "M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Zm4 0V6a4 4 0 0 1 8 0v2",
};

const FALLBACK_ICON_PATH = "M5 12h14M5 7h14M5 17h9";

function NavIcon({ label }: { label: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[19px] w-[19px] shrink-0"
    >
      <path d={NAV_ICON_PATHS[label] ?? FALLBACK_ICON_PATH} />
    </svg>
  );
}

/** Sticky sub-navigation for the active group's items — the "horizontal
 * tab system" that subdivides the topic picked in the left sidebar. Only
 * rendered when the active group actually has more than one page; a
 * single-item group has nothing to subdivide. */
function SubTabs({ groups }: { groups: AppShellNavGroup[] }) {
  const pathname = usePathname();
  const activeGroup = activeGroupFor(groups, pathname);
  if (!activeGroup || activeGroup.items.length < 2) return null;

  return (
    <div className="bg-[var(--color-stone-50)]/95 sticky top-16 z-30 border-b border-black/[0.07] backdrop-blur lg:top-[4.5rem]">
      <nav
        aria-label={`${activeGroup.label} sections`}
        data-paon-subtabs
        className="mx-auto flex max-w-[92rem] gap-1 overflow-x-auto px-4 sm:px-7 lg:px-10 xl:px-14"
      >
        {activeGroup.items.map((item) => {
          const active = isItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              {...(active ? { "aria-current": "page" as const } : {})}
              {...(item.description ? { title: item.description } : {})}
              className={cn(
                "relative shrink-0 whitespace-nowrap px-3 py-3 text-[13px] transition-colors",
                active
                  ? "text-[var(--color-stone-900)]"
                  : "text-[var(--color-stone-500)] hover:text-[var(--color-stone-800)]",
              )}
            >
              {item.label}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-3 -bottom-px h-px bg-[var(--color-stone-900)] transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
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
          <p className="font-accent mb-2 px-3 text-[7px] uppercase tracking-[0.16em] text-white/35">
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
                  <span className="font-display block">{item.label}</span>
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
  personaTitle,
  email,
  navigation,
  mobileDock,
  signOutControl,
  signOutControlMobile,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    // `paon-dark-env` inverts the stone ramp to the customer environment's own
    // values, so every component below paints dark without being rewritten.
    <div className="paon-dark-env min-h-screen bg-[var(--color-stone-50)] text-[var(--color-stone-900)]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[250px] grid-rows-[60px_1fr_auto] overflow-hidden bg-[linear-gradient(to_bottom,#1a1a1a,#4d4d4d)] text-white lg:grid">
        <Link
          href={homeHref}
          className="flex items-center justify-center gap-3 border-b border-white/10 px-6"
        >
          <span className="font-display text-[19px] leading-none tracking-[0.14em]">
            {brand}
          </span>
          <span className="border-l border-white/15 pl-3 text-[8px] uppercase leading-[1.2] tracking-[0.18em] text-white/40">
            {product}
          </span>
        </Link>
        <div className="overflow-y-auto px-[25px] pb-7 pt-[52px]">
          <p className="font-accent mb-2.5 text-[7px] uppercase leading-none tracking-[0.02em] text-[#b5b5b2]">
            Navigation
          </p>
          <SidebarGroups groups={navigation} />
        </div>
        <div className="border-t border-white/10 bg-black/10 px-[25px] py-6">
          <p className="font-accent text-[7px] uppercase tracking-[0.16em] text-white/35">
            Signed in as
          </p>
          <p
            className="font-display mt-2 text-[13px] text-white/85"
            {...(personaTitle ? { title: personaTitle } : {})}
          >
            {persona}
          </p>
          <p className="mt-1 truncate text-[11px] text-white/40">{email}</p>
          <div className="mt-3 [&_button]:!h-auto [&_button]:!px-0 [&_button]:!py-0 [&_button]:!text-[12px] [&_button]:!font-normal [&_button]:!text-[#808080] hover:[&_button]:!bg-transparent hover:[&_button]:!text-white">
            {signOutControl}
          </div>
        </div>
      </aside>

      <div className="lg:pl-[250px]">
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
                <p className="font-accent text-[7px] uppercase tracking-[0.16em] text-[var(--color-stone-500)]">
                  {product}
                </p>
                <p
                  className="font-display text-sm text-[var(--color-stone-800)]"
                  {...(personaTitle ? { title: personaTitle } : {})}
                >
                  {persona}
                </p>
              </div>
            </div>
            <p className="hidden max-w-xs truncate text-xs text-[var(--color-stone-500)] sm:block lg:hidden">
              {email}
            </p>
          </div>
        </header>

        <SubTabs groups={navigation} />

        <main
          className={cn(
            "mx-auto w-full max-w-[92rem] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 xl:px-14",
            mobileDock ? "pb-24 lg:pb-10" : "",
          )}
        >
          {children}
        </main>
      </div>

      {mobileDock ? (
        <nav
          aria-label="Primary (mobile)"
          className="fixed inset-x-0 bottom-0 z-50 grid border-t border-black/10 bg-[var(--color-stone-50)] pb-[env(safe-area-inset-bottom)] lg:hidden"
          style={{
            gridTemplateColumns: `repeat(${Math.min(mobileDock.length, 5)}, minmax(0, 1fr))`,
          }}
        >
          {mobileDock.map((item) => {
            const longerMatch = mobileDock.some(
              (other) =>
                other.href !== item.href &&
                other.href.length > item.href.length &&
                (pathname === other.href ||
                  pathname.startsWith(`${other.href}/`)),
            );
            const active =
              !longerMatch &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={`${item.href}:${item.label}`}
                href={item.href}
                {...(active ? { "aria-current": "page" as const } : {})}
                className={cn(
                  "relative flex min-h-14 items-center justify-center px-1 py-3 text-center text-[10px] uppercase tracking-[0.12em] transition-colors",
                  active
                    ? "text-[var(--color-stone-900)]"
                    : "text-[var(--color-stone-600)]",
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
          <aside className="absolute inset-y-0 left-0 grid w-[min(86vw,22rem)] grid-rows-[60px_1fr_auto] overflow-hidden bg-[linear-gradient(to_bottom,#1a1a1a,#4d4d4d)] text-white shadow-[20px_0_60px_rgba(0,0,0,.35)]">
            <div className="flex items-center justify-between border-b border-white/10 px-6">
              <Link
                href={homeHref}
                onClick={() => setMenuOpen(false)}
                className="font-display text-lg tracking-[0.14em]"
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
              <p
                className="font-display text-sm"
                {...(personaTitle ? { title: personaTitle } : {})}
              >
                {persona}
              </p>
              <p className="mt-1 truncate text-[10px] text-white/40">{email}</p>
              <div className="mt-3 [&_button]:!h-8 [&_button]:!px-0 [&_button]:!text-white/55">
                {signOutControlMobile ?? signOutControl}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
