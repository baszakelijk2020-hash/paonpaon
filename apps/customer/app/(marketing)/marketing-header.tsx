"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/discover/platform", label: "Platform" },
  { href: "/discover/engagement", label: "Engagement" },
  { href: "/discover/weddings-events", label: "Weddings" },
  { href: "/founder", label: "Founder" },
  { href: "/pricing", label: "Packages" },
  { href: "/r/maison-dubois", label: "Live store" },
] as const;

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="glass-panel fixed inset-x-0 top-0 z-50 border-b border-black/10">
      <div className="mx-auto flex h-16 max-w-[92rem] items-center justify-between gap-3 px-5 sm:px-8">
        <Link href="/" className="font-display text-xl tracking-[0.28em]">
          PAON
        </Link>
        <nav
          aria-label="PAON corporate navigation"
          className="hidden items-center gap-7 text-xs md:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/demo-request"
            className="inline-flex min-h-10 items-center rounded-[var(--radius-md)] bg-[#1a1a1a] px-3 text-xs font-medium text-white sm:px-4"
          >
            <span className="sm:hidden">Demo</span>
            <span className="hidden sm:inline">View a personalized demo</span>
          </Link>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-[var(--radius-md)] border border-black/10 md:hidden"
            aria-expanded={open}
            aria-controls="marketing-mobile-nav"
            aria-label={open ? "Close navigation" : "Open navigation"}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="flex w-4 flex-col gap-1">
              <span className="h-px w-full bg-current" />
              <span className="h-px w-full bg-current" />
              <span className="h-px w-full bg-current" />
            </span>
          </button>
        </div>
      </div>
      {open ? (
        <nav
          id="marketing-mobile-nav"
          aria-label="PAON corporate navigation (mobile)"
          className="border-t border-black/10 bg-[var(--color-stone-50)] px-5 py-4 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-[var(--radius-md)] px-3 py-3 text-sm"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
