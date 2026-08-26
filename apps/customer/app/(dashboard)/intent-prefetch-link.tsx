"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useRef } from "react";

type Props = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & {
  children: ReactNode;
  href: string;
};

/**
 * Prefetch only when the customer shows intent, never every sidebar link.
 * `router.prefetch()` only warms Next.js page segments — for a target like
 * `/r/[slug]` that Next resolves to a Route Handler (raw HTML, no RSC
 * segment), it silently no-ops, so a manual `<link rel="prefetch">` is
 * added alongside it to warm that same-origin document in the HTTP cache
 * too. Harmless, deduped no-op for real page targets.
 */
export function IntentPrefetchLink({ children, href, ...props }: Props) {
  const router = useRouter();
  const prefetched = useRef(false);
  const prefetch = useCallback(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    router.prefetch(href);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document";
    link.href = href;
    document.head.appendChild(link);
  }, [href, router]);

  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onPointerEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
    >
      {children}
    </Link>
  );
}
