"use client";

import {
  Fragment,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  getCustomerRouteEntry,
  type CustomerRouteEntry,
} from "../customer-navigation-lifecycle";

/**
 * The dashboard layout persists while the customer moves between its tabs.
 * Reset only this visual subtree when the route visibly re-enters /dashboard,
 * so the mount-driven Morning Routine choreography gets a fresh entrance
 * without remounting the environment or storefront hosts.
 */
export function MorningRoutineVisualRoot({
  children,
}: {
  children: ReactNode;
}) {
  const initialEntry = getCustomerRouteEntry();
  const [entryToken, setEntryToken] = useState(
    initialEntry.pathname === "/dashboard" ? initialEntry.token : 0,
  );
  const appliedToken = useRef(entryToken);

  useLayoutEffect(() => {
    const applyDashboardEntry = (entry: CustomerRouteEntry) => {
      if (
        entry.pathname !== "/dashboard" ||
        entry.token <= appliedToken.current
      )
        return;
      appliedToken.current = entry.token;
      setEntryToken(entry.token);
    };

    const onRouteVisible = (event: Event) => {
      applyDashboardEntry((event as CustomEvent<CustomerRouteEntry>).detail);
    };

    window.addEventListener("paon:customer-route-visible", onRouteVisible);
    applyDashboardEntry(getCustomerRouteEntry());
    return () => {
      window.removeEventListener("paon:customer-route-visible", onRouteVisible);
    };
  }, []);

  return (
    <Fragment key={`morning-routine-entry-${entryToken}`}>{children}</Fragment>
  );
}
