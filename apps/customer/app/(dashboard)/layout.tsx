import { Button, buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";
import { Suspense } from "react";

import { AccountTopTabs, type AccountTab } from "./account-top-tabs";
import { signOut } from "./actions";
import { GuestPortalPreview } from "./guest-portal-preview";
import { ShopCategorySidebar } from "./shop-category-sidebar";

import { getSession } from "@/lib/session";

/** Flat, 8-tab account nav — every prior sub-page still exists at its own
 * URL; pages that used to be separate sidebar entries are now linked from
 * their tab's landing page ("Related" row) instead of consuming a tab
 * slot. Nothing was removed, only regrouped. */
const ACCOUNT_TABS: AccountTab[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/wardrobe", label: "My Wardrobe" },
  { href: "/orders", label: "My Orders" },
  { href: "/appointments", label: "My Appointments" },
  { href: "/morning-routine", label: "My Style" },
  { href: "/loyalty", label: "Loyalty & Referral" },
  { href: "/messages", label: "Messages" },
  { href: "/r/atelier-demo", label: "Table Service" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isCustomer = session?.accountType === "customer";

  if (!isCustomer) {
    return (
      <div className="min-h-screen bg-[var(--color-stone-50)] text-[var(--color-stone-900)] lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <ShopCategorySidebar />
        <div className="min-w-0">
          <nav className="sticky top-0 z-40 flex items-center justify-end border-b border-black/10 bg-white px-4 py-3">
            <Link
              href="/login?redirectTo=%2Fdashboard"
              className={buttonVariants({ size: "sm" })}
            >
              Sign in
            </Link>
          </nav>
          <main className="mx-auto w-full max-w-[92rem] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 xl:px-14">
            <Suspense fallback={null}>
              <GuestPortalPreview />
            </Suspense>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-stone-50)] text-[var(--color-stone-900)] lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <ShopCategorySidebar />
      <div className="min-w-0">
        <AccountTopTabs
          tabs={ACCOUNT_TABS}
          trailing={
            <div className="flex items-center gap-3">
              <a
                href="/account"
                className="text-[13px] text-[var(--color-stone-600)] hover:text-[var(--color-stone-900)]"
              >
                Settings
              </a>
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
          }
        />
        <main className="mx-auto w-full max-w-[92rem] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 xl:px-14">
          {children}
        </main>
      </div>
    </div>
  );
}
