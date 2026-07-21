import { Button } from "@paon/ui/components/Button";
import Link from "next/link";

import { signOut } from "./actions";

import { requireSession } from "@/lib/session";

const BOTTOM_NAV_ITEMS = [
  { href: "/orders", label: "Orders" },
  { href: "/appointments", label: "Appointments" },
  { href: "/messages", label: "Messages" },
  { href: "/account", label: "Account" },
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="min-h-screen bg-[var(--color-stone-50)]">
      <header className="glass-panel sticky top-0 z-40 border-b border-[var(--color-stone-200)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-sm font-medium uppercase tracking-wide text-[var(--color-stone-900)]"
            >
              PAON
            </Link>
            <nav
              aria-label="Primary"
              className="hidden items-stretch gap-5 md:flex md:gap-7"
            >
              <div
                role="group"
                aria-label="My activity"
                className="flex items-center gap-4 lg:gap-6"
              >
                <Link
                  href="/orders"
                  className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                >
                  Orders
                </Link>
                <Link
                  href="/appointments"
                  className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                >
                  Appointments
                </Link>
                <Link
                  href="/alterations"
                  className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                >
                  Alterations
                </Link>
                <Link
                  href="/wishlist"
                  className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                >
                  Wishlist
                </Link>
              </div>
              <div
                role="group"
                aria-label="Community"
                className="flex items-center gap-4 border-l border-[var(--color-stone-200)] pl-5 lg:gap-6 lg:pl-7"
              >
                <Link
                  href="/loyalty"
                  className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                >
                  Loyalty
                </Link>
                <Link
                  href="/events"
                  className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                >
                  Events
                </Link>
                <Link
                  href="/wedding-parties"
                  className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                >
                  Wedding Parties
                </Link>
              </div>
              <div
                role="group"
                aria-label="Inbox"
                className="flex items-center gap-4 border-l border-[var(--color-stone-200)] pl-5 lg:gap-6 lg:pl-7"
              >
                <Link
                  href="/messages"
                  className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                >
                  Messages
                </Link>
                <Link
                  href="/notifications"
                  className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                >
                  Updates
                </Link>
                <Link
                  href="/account"
                  className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                >
                  Account
                </Link>
              </div>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-[var(--color-stone-500)] sm:inline">
              {session.email}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10 pb-24 md:pb-10">
        {children}
      </main>
      <nav
        aria-label="Primary (mobile)"
        className="glass-panel fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-[var(--color-stone-200)] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {BOTTOM_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-11 flex-1 items-center justify-center px-2 py-3 text-center text-xs font-medium text-[var(--color-stone-600)] active:scale-95 motion-reduce:active:scale-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
