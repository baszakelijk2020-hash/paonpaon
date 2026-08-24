"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useCallback, useRef } from "react";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children: ReactNode;
  href: string;
};

/** Prefetch only when the customer shows intent, never every sidebar link. */
export function IntentPrefetchLink({ children, href, ...props }: Props) {
  const router = useRouter();
  const prefetched = useRef(false);
  const prefetch = useCallback(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    router.prefetch(href);
  }, [href, router]);
  const navigate = useCallback(() => {
    if (typeof window === "undefined" || !(window as Window & { gsap?: { to: (target: Element, vars: Record<string, unknown>) => void } }).gsap) return;
    const overlay = document.createElement("div");
    overlay.setAttribute("data-paon-navigation-transition", "true");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "9999",
      pointerEvents: "none",
      background: "#1d1d1d",
      opacity: "0",
    });
    document.body.appendChild(overlay);
    (window as Window & { gsap?: { to: (target: Element, vars: Record<string, unknown>) => void } }).gsap?.to(overlay, {
      opacity: 0.18,
      duration: 0.14,
      ease: "power2.out",
    });
  }, []);

  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onPointerEnter={prefetch}
      onFocus={prefetch}
      onClick={navigate}
    >
      {children}
    </Link>
  );
}
