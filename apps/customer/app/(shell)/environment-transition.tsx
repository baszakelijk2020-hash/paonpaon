"use client";

import { gsap } from "gsap";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

const STORE_PREFIX = "/r/";
const SHELL_SIDEBAR_WIDTH = 250;

function parkedX(overlay: HTMLElement): number {
  const sidebarWidth = window.matchMedia("(min-width: 1024px)").matches
    ? SHELL_SIDEBAR_WIDTH
    : 0;

  // The customer window remains full-width while open; its own dashboard grid
  // already reserves the sidebar column. When hidden, park its right edge at
  // that column so it can emerge from behind the sidebar without adding a
  // second 250px gutter to the open customer view.
  return -Math.max(overlay.getBoundingClientRect().width - sidebarWidth, 0);
}

/**
 * Slides the customer environment over the storefront, and back off it.
 *
 * Both are alive at once: the storefront is a live subtree in <body> that is
 * never rebuilt, and the customer environment is a fixed overlay above it. So
 * moving between them is not a page change at all — it is one panel flying in
 * over another that never goes anywhere. It is animated to match the founder's
 * own grid-to-detail entry, so the two feel like the same gesture.
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
    const hiddenX = parkedX(overlay);

    // The first paint should simply be correct, with nothing to animate from.
    if (first.current) {
      first.current = false;
      gsap.set(overlay, {
        x: inStore ? hiddenX : 0,
        xPercent: 0,
        autoAlpha: inStore ? 0 : 1,
        filter: "blur(0px)",
        pointerEvents: inStore ? "none" : "auto",
      });
      return;
    }

    gsap.killTweensOf(overlay);
    // Nothing under a moving panel should be clickable while it moves.
    overlay.style.pointerEvents = "none";

    if (inStore) {
      /*
       * Leaving: the customer environment flies back behind the left sidebar and the
       * storefront is simply there behind it, exactly as it was left — it is
       * never unmounted, so there is nothing to reveal but itself.
       */
      gsap.to(overlay, {
        x: hiddenX,
        xPercent: 0,
        filter: "blur(18px)",
        duration: 0.62,
        ease: "power3.in",
        force3D: true,
        onComplete: () => {
          gsap.set(overlay, { autoAlpha: 0, filter: "blur(0px)" });
        },
      });
      return;
    }

    /*
     * Arriving: in from behind the left sidebar over the storefront, out of a blur.
     *
     * 0.72s on a quartic ease-out is the founder's own detail-panel entry
     * (paon-template.html's `duration = 720`, `easeOut4`), so opening the
     * customer environment lands with the same weight as opening a jacket.
     */
    gsap.fromTo(
      overlay,
      { x: hiddenX, xPercent: 0, autoAlpha: 1, filter: "blur(18px)" },
      {
        x: 0,
        xPercent: 0,
        filter: "blur(0px)",
        duration: 0.72,
        ease: "power4.out",
        force3D: true,
        onComplete: () => {
          overlay.style.pointerEvents = "auto";
          // Leaving a filter on the element keeps a compositing layer alive and
          // makes it the containing block for anything fixed inside it.
          gsap.set(overlay, { clearProps: "filter" });
        },
      },
    );
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
