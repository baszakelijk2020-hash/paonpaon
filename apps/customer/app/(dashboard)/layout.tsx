import { Button } from "@paon/ui/components/Button";
import Link from "next/link";

import { signOut } from "./actions";

import { requireSession } from "@/lib/session";

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
            <nav className="flex items-center gap-6">
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
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--color-stone-500)]">
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
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
