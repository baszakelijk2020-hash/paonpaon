"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { usePaonEnvironment } from "../environment-store";

/**
 * The sidebar is one mounted component shared by both environments, so which
 * set of menu items it shows has to follow the live environment rather than
 * the route that happened to mount it — the Store / Wardrobe switcher changes
 * environment without navigating.
 *
 * Both sides are the same component type, so React would otherwise reconcile
 * one into the other and keep the instance; the callers key them, which is
 * what lets each side mount fresh (and animate itself in).
 */
export function SidebarEnvironmentNav({
  store,
  account,
}: {
  store: ReactNode;
  account: ReactNode;
}) {
  const pathname = usePathname();
  const environment = usePaonEnvironment(pathname);
  return <>{environment === "store" ? store : account}</>;
}
