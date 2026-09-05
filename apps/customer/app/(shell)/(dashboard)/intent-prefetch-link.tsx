"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";

type Props = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & {
  children: ReactNode;
  href: string;
};

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/** Every sidebar link here goes to the storefront — a customer opening the
 * account area is expected to go shop, so warm it eagerly rather than
 * waiting for hover, unless the visitor is on a constrained connection. */
function isConstrainedConnection(): boolean {
  const connection = (
    navigator as Navigator & { connection?: NetworkInformation }
  ).connection;
  if (!connection) return false;
  return Boolean(
    connection.saveData || /(^|-)2g$/.test(connection.effectiveType ?? ""),
  );
}

/**
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

  useEffect(() => {
    if (isConstrainedConnection()) return;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(prefetch);
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const timeout = window.setTimeout(prefetch, 200);
    return () => window.clearTimeout(timeout);
  }, [prefetch]);

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
