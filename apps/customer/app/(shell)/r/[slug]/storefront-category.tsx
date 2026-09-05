"use client";

import { useEffect } from "react";

import { showStorefrontCategory } from "../../storefront-host";

/**
 * Tells the storefront which category the URL is asking for.
 *
 * The host owns the storefront but cannot read the query itself: reading it
 * with `useSearchParams` in a layout opts every page beneath it out of static
 * rendering, and `usePathname` does not change when only the query does. The
 * route already receives it, so the route hands it over.
 */
export function StorefrontCategory({ category }: { category: string | null }) {
  useEffect(() => {
    showStorefrontCategory(category);
  }, [category]);

  return null;
}
