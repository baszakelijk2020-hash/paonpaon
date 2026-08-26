"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const CUSTOMER_DESTINATIONS = [
  "/dashboard",
  "/wardrobe",
  "/appointments",
  "/orders",
  "/digital-fitting-room",
  "/loyalty",
  "/account",
] as const;

/**
 * Lives in the persistent customer layout so each destination is warmed once
 * after sign-in and stale RSC data is refreshed only after cached UI is shown.
 */
export function CustomerNavigationLifecycle() {
  const pathname = usePathname();
  const router = useRouter();
  const initialPathname = useRef(pathname);
  const refreshedPathnames = useRef(new Set<string>());

  useEffect(() => {
    for (const destination of CUSTOMER_DESTINATIONS) {
      router.prefetch(destination);
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    const animationFrameId = window.requestAnimationFrame(() => {
      if (cancelled) return;

      window.dispatchEvent(
        new CustomEvent("paon:customer-route-visible", {
          detail: { pathname },
        }),
      );

      if (
        pathname === initialPathname.current ||
        refreshedPathnames.current.has(pathname)
      ) {
        return;
      }

      refreshedPathnames.current.add(pathname);
      timeoutId = window.setTimeout(() => {
        if (!cancelled) router.refresh();
      }, 0);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrameId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [pathname, router]);

  return (
    <span
      aria-hidden="true"
      data-customer-navigation-ready={pathname}
      className="hidden"
    />
  );
}
