"use client";

import { gsap } from "gsap";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { usePaonEnvironment } from "./environment-store";

/**
 * Fast enough to read as a toggle rather than a journey. The move used to take
 * 0.42s and felt like waiting for it.
 */
const DURATION = 0.22;

/** The founder's own reveal, from the product grid: blur 14px, 22px of rise. */
const BLUR = "blur(14px)";
const SHARP = "blur(0px)";
const RISE = 22;

/**
 * Slides the customer environment out from behind the left sidebar, over the
 * storefront, and back again.
 *
 * Both are alive at once: the storefront is a live subtree in <body> that is
 * never rebuilt, and the customer environment is a fixed overlay above it. So
 * moving between them is not a page change at all — it is one panel sliding
 * over another that never goes anywhere. Nothing is fetched, nothing is
 * routed, nothing is remounted; the only thing that changes is a transform.
 *
 * The panel arrives the way the founder's product grid arrives: out of a blur,
 * lifting, coming up to full opacity — `#product-grid .grid-card` in
 * paon-template.html, whose numbers (14px of blur, 22px of rise, the
 * .22/.61/.36/1 curve) are the ones used here. Only compositor properties are
 * touched — transform, opacity, filter — so the move never reaches layout.
 */
export function EnvironmentTransition() {
  const pathname = usePathname();
  const environment = usePaonEnvironment(pathname);
  const inStore = environment === "store";
  const first = useRef(true);

  useLayoutEffect(() => {
    const overlay = document.querySelector<HTMLElement>(
      "[data-paon-customer-layer]",
    );
    if (!overlay) return;

    document.body.classList.toggle("paon-storefront-active", inStore);
    overlay.setAttribute("aria-hidden", String(inStore));
    overlay.inert = inStore;

    const away = {
      xPercent: -100,
      y: RISE,
      opacity: 0,
      filter: BLUR,
      force3D: true,
    };
    const here = {
      xPercent: 0,
      y: 0,
      opacity: 1,
      filter: SHARP,
      force3D: true,
    };

    // First paint: put the panel at the right end with no animation, or it
    // flies in from the corner on load.
    if (first.current) {
      first.current = false;
      gsap.set(overlay, inStore ? away : here);
      return;
    }

    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : DURATION;

    // A switch pressed mid-switch continues from where the panel actually is,
    // rather than restarting from the far end.
    gsap.killTweensOf(overlay);
    // Promoted for the length of the move only. Left on permanently, a layer
    // this size is re-rastered on every window-resize frame, and the storefront
    // shows through while it is being redrawn.
    overlay.style.willChange = "transform, opacity, filter";
    gsap.to(overlay, {
      ...(inStore ? away : here),
      duration,
      // Out of the gate immediately, settling rather than easing in — the
      // gesture should be over before it is thought about.
      ease: inStore ? "power2.in" : "expo.out",
      overwrite: "auto",
      onComplete: () => {
        overlay.style.willChange = "";
      },
    });
  }, [inStore]);

  /*
   * Put the panel back at its resting end after a resize.
   *
   * Crossing the 1024px breakpoint changes the panel's `left` (it clears the
   * sidebar above that width and fills the window below it), which changes the
   * width its -100% rest position is measured against. Re-asserting settles it
   * in one frame instead of leaving a stale transform behind the drag.
   */
  useEffect(() => {
    const overlay = document.querySelector<HTMLElement>(
      "[data-paon-customer-layer]",
    );
    if (!overlay) return;
    let frame = 0;
    const settle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (gsap.isTweening(overlay)) return;
        gsap.set(
          overlay,
          inStore
            ? { xPercent: -100, y: RISE, opacity: 0, filter: BLUR }
            : { xPercent: 0, y: 0, opacity: 1, filter: SHARP },
        );
      });
    };
    window.addEventListener("resize", settle);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", settle);
    };
  }, [inStore]);

  useEffect(() => {
    const applyStorefrontAccessibility = () => {
      const storefront = document.querySelector<HTMLElement>(
        ".paon-template-root",
      );
      if (!storefront) return false;
      storefront.inert = !inStore;
      storefront.setAttribute("aria-hidden", String(!inStore));
      return true;
    };

    if (applyStorefrontAccessibility()) return;
    const observer = new MutationObserver(() => {
      if (applyStorefrontAccessibility()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [inStore]);

  return null;
}
