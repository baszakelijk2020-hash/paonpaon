import { Suspense } from "react";

import "./customer-environment.css";

import { CustomerNavigationLifecycle } from "./customer-navigation-lifecycle";
import { EnvironmentMotion } from "./environment-motion";
import { GuestDashboardPreview } from "./guest-dashboard-preview";
import { GuestPortalPreview } from "./guest-portal-preview";

import { getSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isCustomer = session?.accountType === "customer";

  if (!isCustomer) {
    return (
      <div className="customer-page min-h-screen">
        <div className="min-w-0">
          <main className="mx-auto w-full max-w-[92rem] px-4 py-0 sm:px-7 lg:px-10 xl:px-14">
            <Suspense fallback={null}>
              <GuestPortalPreview backdrop={<GuestDashboardPreview />} />
            </Suspense>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div data-customer-shell className="paon-env customer-page min-h-screen">
      <div className="relative z-10 min-w-0">
        <CustomerNavigationLifecycle />
        <EnvironmentMotion />
        <main className="pe-workspace">{children}</main>
      </div>
    </div>
  );
}
