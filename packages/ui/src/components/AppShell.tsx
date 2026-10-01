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

/** The customer environment's sidebar: one row per group, 12px/500 at
 * negative tracking with a 13px mark, 12px between rows. The active group
 * opens its own pages beneath it as the customer's category rows do —
 * 12px/500, 30px tall, indented to the label, half opacity until active. */
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
    <nav aria-label="Primary" className="flex flex-col">
      {groups.map((group, index) => {
        const active = group.label === activeGroup?.label;
        const target = group.items[0]?.href ?? "#";
        return (
          <div key={group.label} className={index === 0 ? "" : "mt-3"}>
            <Link
              href={target}
              data-paon-nav-row
              {...(active ? { "aria-current": "true" as const } : {})}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              className={cn(
                "group flex min-h-[26px] items-center gap-2 text-[12px] font-medium leading-none tracking-[-0.01em] transition-[color] duration-[220ms] ease-[cubic-bezier(.22,.61,.36,1)] [&_svg]:transition-[filter] [&_svg]:duration-[220ms]",
                active
                  ? "text-white [&_svg]:[filter:drop-shadow(0_0_4px_rgba(255,255,255,.9))_drop-shadow(0_0_12px_rgba(255,255,255,.55))]"
                  : "text-[#b5b5b2] hover:text-white",
              )}
            >
              <NavIcon label={group.label} />
              {group.label}
            </Link>
            {active && group.items.length > 1 ? (
              <div className="mt-1 flex flex-col">
                {group.items.map((item) => {
                  const current = isItemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      {...(current ? { "aria-current": "page" as const } : {})}
                      {...(item.description ? { title: item.description } : {})}
                      {...(onNavigate ? { onClick: onNavigate } : {})}
                      className={cn(
                        "flex min-h-[30px] items-center pl-[21px] text-[12px] font-medium leading-none tracking-[-0.01em] text-white transition-opacity duration-[220ms]",
                        current
                          ? "opacity-100"
                          : "opacity-50 hover:opacity-100",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
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
  Operate:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  Intelligence: "M4 20V10m6 10V4m6 16v-7m6 7H2",
  Environment:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z",
};

const FALLBACK_ICON_PATH = "M5 12h14M5 7h14M5 17h9";

function NavIcon({ label }: { label: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[13px] w-[13px] shrink-0"
    >
      <path d={NAV_ICON_PATHS[label] ?? FALLBACK_ICON_PATH} />
    </svg>
  );
}

/** On phones and tablets the sidebar is a drawer, so the active group's pages
 * also run as the customer environment's pill rail above the page. */
function SubTabs({ groups }: { groups: AppShellNavGroup[] }) {
  const pathname = usePathname();
  const activeGroup = activeGroupFor(groups, pathname);
  if (!activeGroup || activeGroup.items.length < 2) return null;

  return (
    <div className="sticky top-14 z-30 bg-[#161616]/90 px-4 py-2 backdrop-blur-xl sm:px-7 lg:hidden">
      <nav
        aria-label={`${activeGroup.label} sections`}
        data-paon-subtabs
        className="flex gap-1 overflow-x-auto rounded-full bg-[#17191a] p-[5px]"
      >
        {activeGroup.items.map((item) => {
          const active = isItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              {...(active ? { "aria-current": "page" as const } : {})}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-[#c4e9d0] text-[#172b21]"
                  : "text-[#aeb4b7] hover:text-white",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
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

  const signOutPill =
    "[&_button]:!flex [&_button]:!h-12 [&_button]:!w-full [&_button]:!items-center [&_button]:!justify-start [&_button]:!rounded-full [&_button]:!border [&_button]:!border-white/15 [&_button]:!bg-transparent [&_button]:!px-5 [&_button]:!text-[14px] [&_button]:!font-normal [&_button]:!text-[#e4e4e1] hover:[&_button]:!bg-white/[.06]";

  const account = (
    <div className="flex flex-col gap-[10px] px-5 pb-5 pt-3">
      <div className="px-1">
        <p
          className="text-[12px] font-medium tracking-[-0.01em] text-white"
          {...(personaTitle ? { title: personaTitle } : {})}
        >
          {persona}
        </p>
        <p className="mt-1 truncate text-[11px] text-[rgba(181,181,178,.85)]">
          {email}
        </p>
      </div>
      <div className={signOutPill}>{signOutControl}</div>
    </div>
  );

  return (
    // `paon-dark-env` gives everything inside the customer environment's
    // ground, type and tile material; the sidebar below is its sidebar.
    <div className="paon-dark-env min-h-screen">
      <aside className="paon-side fixed inset-y-0 left-0 z-50 hidden w-[250px] grid-cols-[minmax(0,1fr)] grid-rows-[60px_auto_1fr_auto] overflow-hidden bg-[linear-gradient(to_bottom,#1a1a1a,#4d4d4d)] text-white lg:grid">
        <Link
          href={homeHref}
          className="paon-wordmark flex items-center justify-center text-[13px] uppercase leading-none"
        >
          {brand}
        </Link>
        <div className="px-[25px] pb-2">
          <div className="paon-side-chip">
            <span>{product}</span>
          </div>
        </div>
        <div className="overflow-y-auto px-[25px] pb-4 pt-[26px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SidebarGroups groups={navigation} />
        </div>
        {account}
      </aside>

      <div className="lg:pl-[250px]">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-[#161616]/90 px-4 backdrop-blur-xl sm:px-7 lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="flex size-10 items-center justify-center rounded-full bg-white/[.06] text-white"
          >
            <span className="flex w-4 flex-col gap-1">
              <span className="h-px w-full bg-current" />
              <span className="h-px w-full bg-current" />
              <span className="h-px w-full bg-current" />
            </span>
          </button>
          <Link
            href={homeHref}
            className="paon-wordmark text-[13px] uppercase leading-none"
          >
            {brand}
          </Link>
          <span className="size-10" aria-hidden="true" />
        </header>

        <SubTabs groups={navigation} />

        <main
          className={cn(
            "mx-auto w-full max-w-[1600px] px-[14px] pb-10 pt-[18px] sm:px-7 sm:pb-[70px] sm:pt-7",
            mobileDock ? "pb-24 lg:pb-[70px]" : "",
          )}
        >
          {children}
        </main>
      </div>

      {mobileDock ? (
        <nav
          aria-label="Primary (mobile)"
          className="fixed inset-x-0 bottom-0 z-50 grid border-t border-white/10 bg-[#161616]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
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
                  "flex min-h-14 items-center justify-center px-1 py-3 text-center text-[12px] font-medium tracking-[-0.01em] transition-colors",
                  active ? "text-white" : "text-[#8a8a87]",
                )}
              >
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
          <aside className="absolute inset-y-0 left-0 grid w-[min(86vw,280px)] grid-cols-[minmax(0,1fr)] grid-rows-[60px_1fr_auto] overflow-hidden bg-[linear-gradient(to_bottom,#1a1a1a,#4d4d4d)] text-white shadow-[20px_0_60px_rgba(0,0,0,.35)]">
            <div className="flex items-center justify-between px-[25px]">
              <Link
                href={homeHref}
                onClick={() => setMenuOpen(false)}
                className="paon-wordmark text-[13px] uppercase leading-none"
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
            <div className="overflow-y-auto px-[25px] pt-[26px]">
              <SidebarGroups
                groups={navigation}
                onNavigate={() => setMenuOpen(false)}
              />
            </div>
            <div
              className={cn(
                "flex flex-col gap-[10px] px-5 pb-5 pt-3",
                signOutPill,
              )}
            >
              <p className="px-1 text-[12px] text-white">{persona}</p>
              {signOutControlMobile ?? signOutControl}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
