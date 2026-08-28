"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";

function StoreReturnCaptureContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  useEffect(() => {
    if (!returnTo) return;

    // Validate returnTo: must start with /r/<slug>, reject open redirects
    const validReturnToRegex = /^\/r\/[A-Za-z0-9_-]+(?:[/?].*)?$/;
    if (!validReturnToRegex.test(returnTo)) return;

    // Store in cookie for the sidebar (a Server Component) to read.
    document.cookie = `paon_storefront_return=${encodeURIComponent(returnTo)}; path=/; max-age=86400; samesite=lax`;

    // Remove returnTo from URL and navigate cleanly.
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete("returnTo");
    const newSearch = newSearchParams.toString();
    const newUrl = newSearch ? `${pathname}?${newSearch}` : pathname;
    router.replace(newUrl);
    // `replace` alone can serve the sidebar's segment from the client
    // router cache, which has no way to know the cookie just changed —
    // `refresh` forces every Server Component on this route (including
    // ShopCategorySidebar) to re-render against the cookie set above, on
    // this same navigation rather than the next one.
    router.refresh();
  }, [returnTo, pathname, searchParams, router]);

  return null;
}

export function StoreReturnCapture() {
  return (
    <Suspense fallback={null}>
      <StoreReturnCaptureContent />
    </Suspense>
  );
}
