import { buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";
import { Suspense } from "react";

import { AccountTopTabs, type AccountTab } from "./account-top-tabs";
import { CustomerNavigationLifecycle } from "./customer-navigation-lifecycle";
import { GuestPortalPreview } from "./guest-portal-preview";
import { ShopCategorySidebar } from "./shop-category-sidebar";

import { getSession } from "@/lib/session";

/** Flat, 7-tab account nav — every prior sub-page still exists at its own
 * URL; pages that used to be separate sidebar entries are now linked from
 * their tab's landing page ("Related" row) instead of consuming a tab
 * slot. Nothing was removed, only regrouped. */
const ACCOUNT_TABS: AccountTab[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/appointments", label: "My Appointments" },
  { href: "/orders", label: "Orders" },
  { href: "/digital-fitting-room", label: "Digital Fitting Room" },
  { href: "/loyalty", label: "Rewards & Referrals" },
  { href: "/account", label: "My Profile" },
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
      <div className="customer-page min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <ShopCategorySidebar />
        <div className="min-w-0">
          <nav className="sticky top-0 z-40 flex h-[60px] items-center justify-end border-b border-black/10 bg-white px-4 py-3">
            <Link
              href="/login?demo=1&email=contact%2Bisabelle%40nebelspiegel.com&redirectTo=%2Fdashboard"
              className={buttonVariants({ size: "sm" })}
            >
              Customer Demo
            </Link>
          </nav>
          <main className="mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-7 sm:py-8 lg:px-10 xl:px-14">
            <Suspense fallback={null}>
              <GuestPortalPreview />
            </Suspense>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div
      data-customer-shell
      className="customer-page min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)]"
    >
      <ShopCategorySidebar />
      <div className="min-w-0">
        <CustomerNavigationLifecycle />
        <AccountTopTabs tabs={ACCOUNT_TABS} />
        <main className="mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-7 sm:py-8 lg:px-10 xl:px-14">
          {children}
        </main>
      </div>
    </div>
  );
}
