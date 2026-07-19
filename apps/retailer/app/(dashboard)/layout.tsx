import {
  retailerRoleAtLeast,
  retailerRoleHasAlterationsPermission,
} from "@paon/domain";
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
  const canConfigureAlterations = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "configure",
  );
  const canManageWorkshop = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "manage_assigned_workshop",
  );
  const isWorkshopRole = ["workshop_manager", "worker"].includes(
    session.retailerRole,
  );
  const homeHref = isWorkshopRole ? "/alterations" : "/dashboard";

  return (
    <div className="min-h-screen bg-[var(--color-stone-50)]">
      <header className="border-b border-[var(--color-stone-200)] bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-8">
            <Link
              href={homeHref}
              className="text-sm font-medium uppercase tracking-wide text-[var(--color-stone-900)]"
            >
              Retailer Portal
            </Link>
            <nav className="flex max-w-full items-center gap-4 overflow-x-auto pb-1 lg:gap-6">
              {!isWorkshopRole ? (
                <>
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
                  {canManageCatalog ? (
                    <Link
                      href="/analytics"
                      className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                    >
                      Analytics
                    </Link>
                  ) : null}
                  {canManageCatalog ? (
                    <Link
                      href="/loyalty"
                      className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                    >
                      Loyalty
                    </Link>
                  ) : null}
                  {canManageCatalog ? (
                    <Link
                      href="/events"
                      className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                    >
                      Events
                    </Link>
                  ) : null}
                </>
              ) : null}
              <Link
                href="/alterations"
                className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
              >
                Alterations
              </Link>
              {canConfigureAlterations || canManageWorkshop ? (
                <>
                  <Link
                    href="/alterations/catalogue"
                    className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                  >
                    {canManageWorkshop
                      ? "Workshop prices"
                      : "Alteration settings"}
                  </Link>
                  {canConfigureAlterations ? (
                    <Link
                      href="/alterations/workshops"
                      className="text-sm text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
                    >
                      Workshops
                    </Link>
                  ) : null}
                </>
              ) : null}
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
          <div className="flex items-center justify-between gap-4 lg:justify-end">
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
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
