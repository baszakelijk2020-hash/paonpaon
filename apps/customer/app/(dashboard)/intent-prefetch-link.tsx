"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useRef } from "react";

type Props = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & {
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
    if (typeof window === "undefined") return;
    const overlay = document.createElement("div");
    overlay.setAttribute("data-paon-navigation-transition", "true");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "9999",
      pointerEvents: "none",
      background: "#b86f3f",
      transform: "translateY(100%)",
      transition: "transform 420ms cubic-bezier(.76,0,.24,1)",
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.transform = "translateY(0)";
    });
    window.setTimeout(() => {
      overlay.style.transform = "translateY(-100%)";
    }, 180);
    window.setTimeout(() => overlay.remove(), 650);
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
