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
 * Warms the target ahead of the click.
 *
 * `/r/[slug]` used to be a Route Handler serving raw HTML — no RSC segment
 * for `router.prefetch()` to warm, hence the manual `<link rel="prefetch">`
 * that this used instead. It is a real page now, so `router.prefetch()` warms
 * the actual React payload, and `prefetch` on the Link itself lets Next warm
 * it as soon as the link is in the viewport rather than only on intent.
 *
 * The document-level `<link rel="prefetch">` is deliberately gone: for a page
 * route it warms a full HTML response the client navigation never uses, and
 * on the storefront that response embeds the whole serialized template.
 */
export function IntentPrefetchLink({ children, href, ...props }: Props) {
  const router = useRouter();
  const prefetched = useRef(false);
  const prefetch = useCallback(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    router.prefetch(href);
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
      onPointerEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
    >
      {children}
    </Link>
  );
}
