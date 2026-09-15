"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

export type CustomerRouteEntry = Readonly<{
  pathname: string;
  token: number;
}>;

let currentRouteEntry: CustomerRouteEntry = { pathname: "", token: 0 };

export function getCustomerRouteEntry(): CustomerRouteEntry {
  return currentRouteEntry;
}

/**
 * Lives in the persistent customer layout. The mounted top-menu Links own full
 * App Router prefetches after hydration; this component only marks the first
 * painted route for browser proof and must never invalidate the warmed App
 * Router payloads while the customer is navigating.
 */
export function CustomerNavigationLifecycle() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    currentRouteEntry = {
      pathname,
      token: currentRouteEntry.token + 1,
    };
    window.dispatchEvent(
      new CustomEvent<CustomerRouteEntry>("paon:customer-route-visible", {
        detail: currentRouteEntry,
      }),
    );
  }, [pathname]);

  return (
    <span
      aria-hidden="true"
      data-customer-navigation-ready={pathname}
      className="hidden"
    />
  );
}
