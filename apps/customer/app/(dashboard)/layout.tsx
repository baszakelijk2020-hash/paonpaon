import { buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";
import { Suspense } from "react";

import { AccountTopTabs, type AccountTab } from "./account-top-tabs";
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
  { href: "/appointments", label: "Service" },
  { href: "/orders", label: "Orders" },
  { href: "/morning-routine", label: "Daily edit" },
  { href: "/messages", label: "Messages" },
  { href: "/r/atelier-demo", label: "Shop" },
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
          <nav className="sticky top-0 z-40 flex h-[60px] items-center justify-end border-b border-black/10 bg-white px-4 py-3">
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
            <a
              href="/account"
              className="px-4 text-[15px] text-[var(--color-stone-700)] transition hover:text-[var(--color-stone-900)]"
            >
              Profile
            </a>
          }
        />
        <main className="mx-auto w-full max-w-[92rem] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 xl:px-14">
          {children}
        </main>
      </div>
    </div>
  );
}
