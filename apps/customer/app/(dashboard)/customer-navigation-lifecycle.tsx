"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Lives in the persistent customer layout. The mounted top-menu Links own full
 * App Router prefetches after hydration; this component only marks the first
 * painted route for browser proof and must never invalidate the warmed App
 * Router payloads while the customer is navigating.
 */
export function CustomerNavigationLifecycle() {
  const pathname = usePathname();

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent("paon:customer-route-visible", {
          detail: { pathname },
        }),
      );
    });
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [pathname]);

  return (
    <span
      aria-hidden="true"
      data-customer-navigation-ready={pathname}
      className="hidden"
    />
  );
}
