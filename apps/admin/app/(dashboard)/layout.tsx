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
      <header className="border-b border-[var(--color-stone-200)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link
              href="/retailers"
              className="text-sm font-medium uppercase tracking-wide text-[var(--color-stone-900)]"
            >
              PAON Admin
            </Link>
            <nav className="flex items-center gap-6">
              <Link
                href="/retailers"
                className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
              >
                Retailers
              </Link>
              <Link
                href="/analytics"
                className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
              >
                Analytics
              </Link>
              <Link
                href="/billing"
                className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
              >
                Billing
              </Link>
              <Link
                href="/ai-monitoring"
                className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
              >
                AI monitoring
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
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
