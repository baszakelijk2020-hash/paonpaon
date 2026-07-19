import { retailerRoleAtLeast } from "@paon/domain";
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
  const canManageRetailer = retailerRoleAtLeast(session.retailerRole, "admin");
  const canManageCustomers = retailerRoleAtLeast(
    session.retailerRole,
    "sales_associate",
  );
  const canManageCatalog = retailerRoleAtLeast(session.retailerRole, "manager");

  return (
    <div className="min-h-screen bg-[var(--color-stone-50)]">
      <header className="border-b border-[var(--color-stone-200)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-sm font-medium uppercase tracking-wide text-[var(--color-stone-900)]"
            >
              Retailer Portal
            </Link>
            <nav className="flex items-center gap-6">
              <Link
                href="/dashboard"
                className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
              >
                Dashboard
              </Link>
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
              {canManageCustomers ? (
                <Link
                  href="/customers"
                  className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                >
                  Customers
                </Link>
              ) : null}
              {canManageCatalog ? (
                <Link
                  href="/products"
                  className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                >
                  Products
                </Link>
              ) : null}
              {canManageRetailer ? (
                <>
                  <Link
                    href="/staff"
                    className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                  >
                    Staff
                  </Link>
                  <Link
                    href="/settings"
                    className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                  >
                    Settings
                  </Link>
                </>
              ) : null}
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
