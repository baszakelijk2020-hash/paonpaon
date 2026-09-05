"use client";

import { gsap } from "gsap";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

const STORE_PREFIX = "/r/";

/**
 * Crossfades between the two environments.
 *
 * Both are alive at once: the storefront is a live subtree in <body> that is
 * never rebuilt, and the customer environment is a fixed overlay above it. So
 * moving between them is not a page change at all — it is one element fading
 * over another, and it is animated the way the founder's template animates its
 * own grid-to-detail transition rather than cutting.
 *
 * The overlay stays `position: fixed` in both states. Letting it return to
 * flow made it take space above the storefront, which is the band of customer
 * environment that used to show across the storefront's page.
 */
export function EnvironmentTransition() {
  const pathname = usePathname();
  const router = useRouter();
  const inStore = pathname.startsWith(STORE_PREFIX);
  const first = useRef(true);

  useLayoutEffect(() => {
    const overlay = document.querySelector<HTMLElement>(".paon-shell-content");
    if (!overlay) return;

    document.body.classList.toggle("paon-storefront-active", inStore);

    // The first paint should simply be correct, with nothing to animate from.
    if (first.current) {
      first.current = false;
      gsap.set(overlay, {
        autoAlpha: inStore ? 0 : 1,
        pointerEvents: inStore ? "none" : "auto",
      });
      return;
    }

    gsap.killTweensOf(overlay);
    gsap.to(overlay, {
      autoAlpha: inStore ? 0 : 1,
      duration: 0.42,
      ease: "power2.inOut",
      // Nothing behind a fading overlay should be clickable mid-flight.
      onStart: () => {
        overlay.style.pointerEvents = "none";
      },
      onComplete: () => {
        overlay.style.pointerEvents = inStore ? "none" : "auto";
      },
    });
  }, [inStore]);

  /*
   * Warm the other side before it is asked for.
   *
   * Whichever environment you are in, the other one is a single click away and
   * is the click most visitors make. Prefetching both directions on arrival
   * means the payload is already in the router cache by the time the pill is
   * pressed, so the crossfade is the only thing that has to happen.
   */
  useEffect(() => {
    const warm = () => {
      router.prefetch("/dashboard");
      const store = document.querySelector<HTMLAnchorElement>(
        '[data-paon-shell-sidebar] a[href^="/r/"]',
      );
      if (store)
        router.prefetch(store.getAttribute("href") ?? "/r/atelier-demo");
    };
    const idle = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idle.requestIdleCallback) {
      const handle = idle.requestIdleCallback(warm);
      return () => idle.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(warm, 200);
    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  return null;
}
