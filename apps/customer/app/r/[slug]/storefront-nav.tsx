"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface NavLink {
  href: string;
  label: string;
  description: string;
}

const MENU_LINKS: NavLink[] = [
  { href: "products", label: "Shop", description: "The full collection" },
  { href: "swipe", label: "Find your style", description: "Swipe to save" },
  {
    href: "appointments",
    label: "Book an appointment",
    description: "A complimentary fitting",
  },
];

export function StorefrontNav({
  slug,
  retailerName,
}: {
  slug: string;
  retailerName: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <>
      {/* Desktop/tablet: a slim top bar reads as "an app" better than a
          full-width phone dock stretched across a wide viewport. */}
      <header className="glass-panel fixed inset-x-0 top-0 z-40 hidden h-16 items-center justify-between border-b border-[var(--color-stone-200)] px-8 lg:flex">
        <Link
          href={`/r/${slug}`}
          className="text-lg font-[var(--font-display)] tracking-[0.08em] text-[var(--color-stone-900)]"
        >
          {retailerName}
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-8">
          <Link
            href={`/r/${slug}/products`}
            className="text-sm text-[var(--color-stone-700)] transition-colors hover:text-[var(--color-stone-950)]"
          >
            Shop
          </Link>
          <Link
            href={`/r/${slug}/swipe`}
            className="text-sm text-[var(--color-stone-700)] transition-colors hover:text-[var(--color-stone-950)]"
          >
            Find your style
          </Link>
          <Link
            href={`/r/${slug}/appointments`}
            className="text-sm text-[var(--color-stone-700)] transition-colors hover:text-[var(--color-stone-950)]"
          >
            Book an appointment
          </Link>
          <Link
            href="/loyalty"
            className="text-sm text-[var(--color-stone-700)] transition-colors hover:text-[var(--color-stone-950)]"
          >
            Rewards
          </Link>
          <Link
            href={`/login?redirectTo=${encodeURIComponent(`/r/${slug}/products`)}`}
            className="rounded-full border border-[var(--color-stone-300)] px-4 py-1.5 text-sm text-[var(--color-stone-900)] transition-colors hover:border-[var(--color-stone-500)]"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Mobile/tablet: sticky bottom dock, matching AppShell's mobileDock. */}
      <nav
        aria-label="Primary"
        className="glass-panel fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[var(--color-stone-200)] pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <Link
          href={`/r/${slug}/products`}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] text-[var(--color-stone-700)]"
        >
          <span aria-hidden="true" className="text-base">
            ◧
          </span>
          Shop
        </Link>
        <Link
          href={`/r/${slug}/swipe`}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] text-[var(--color-stone-700)]"
        >
          <span aria-hidden="true" className="text-base">
            ♡
          </span>
          Style
        </Link>
        <Link
          href={`/r/${slug}/appointments`}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] text-[var(--color-stone-700)]"
        >
          <span aria-hidden="true" className="text-base">
            ⏵
          </span>
          Book
        </Link>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] text-[var(--color-stone-700)]"
        >
          <span aria-hidden="true" className="text-base">
            ≡
          </span>
          Menu
        </button>
      </nav>

      {menuOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden" role="presentation">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 right-0 grid w-[min(86vw,22rem)] grid-rows-[4.5rem_1fr] overflow-hidden bg-[linear-gradient(110deg,#333_0%,#171716_72%)] text-white shadow-[-20px_0_60px_rgba(0,0,0,.35)]"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6">
              <p className="text-lg font-[var(--font-display)] tracking-[0.14em]">
                Menu
              </p>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
              >
                ×
              </button>
            </div>
            <nav
              aria-label="Navigation links"
              className="flex flex-col px-2 py-4"
            >
              {MENU_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={`/r/${slug}/${link.href}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex flex-col gap-0.5 rounded-[var(--radius-sm)] px-4 py-3 hover:bg-white/5"
                >
                  <span className="text-base">{link.label}</span>
                  <span className="text-xs text-white/50">
                    {link.description}
                  </span>
                </Link>
              ))}
              <Link
                href="/loyalty"
                onClick={() => setMenuOpen(false)}
                className="flex flex-col gap-0.5 rounded-[var(--radius-sm)] px-4 py-3 hover:bg-white/5"
              >
                <span className="text-base">Rewards</span>
                <span className="text-xs text-white/50">
                  Points, tiers and referrals
                </span>
              </Link>
              <Link
                href={`/login?redirectTo=${encodeURIComponent(`/r/${slug}/products`)}`}
                onClick={() => setMenuOpen(false)}
                className="mt-4 flex flex-col gap-0.5 border-t border-white/10 px-4 pt-4 text-sm text-white/70"
              >
                Sign in
              </Link>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
