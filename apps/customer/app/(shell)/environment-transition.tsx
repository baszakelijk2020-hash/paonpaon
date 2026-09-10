"use client";

import { gsap } from "gsap";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { usePaonEnvironment } from "./environment-store";

/**
 * A 100px left-origin focus reveal for the My PAON environment.
 */
const ENTER_DURATION = 0.24;
const ENTER_OPACITY_DURATION = 0.12;
const EXIT_DURATION = 0.2;
const PRODUCT_BLUR_DURATION = 0.9;
const STOREFRONT_BLUR_DURATION = 1.3;
const PRODUCT_BLUR = "blur(14px)";
const SHARP = "blur(0px)";

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
 * The panel begins 100px left of its final position, then shoots right into
 * place from zero opacity and a product-card blur. It never moves vertically
 * or scales.
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
      x: -100,
      opacity: 0,
      filter: PRODUCT_BLUR,
      force3D: true,
    };
    const here = {
      x: 0,
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

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reducedMotion
      ? 0
      : inStore
        ? EXIT_DURATION
        : ENTER_DURATION;

    // A switch pressed mid-switch continues from where the panel actually is,
    // rather than restarting from the far end.
    gsap.killTweensOf(overlay);
    // Promoted for the length of the move only. Left on permanently, a layer
    // this size is re-rastered on every window-resize frame, and the storefront
    // shows through while it is being redrawn.
    overlay.style.willChange = "transform, opacity, filter";
    const target = inStore ? away : here;
    const transition = gsap.timeline({
      onComplete: () => {
        overlay.style.willChange = "";
      },
    });
    if (inStore) {
      transition.to(
        overlay,
        {
          x: target.x,
          opacity: target.opacity,
          duration,
          ease: "power3.in",
          force3D: true,
        },
        0,
      );
    } else {
      transition
        .to(
          overlay,
          {
            x: target.x,
            duration,
            ease: "power4.out",
            force3D: true,
          },
          0,
        )
        .to(
          overlay,
          {
            opacity: target.opacity,
            duration: reducedMotion ? 0 : ENTER_OPACITY_DURATION,
            ease: "power2.out",
          },
          0,
        );
    }
    transition.to(
      overlay,
      {
        filter: target.filter,
        duration: inStore ? EXIT_DURATION : PRODUCT_BLUR_DURATION,
        ease: inStore ? "power3.in" : "power3.out",
      },
      0,
    );

    const storefront = document.querySelector<HTMLElement>(
      ".paon-template-root",
    );
    if (!storefront) return;

    gsap.killTweensOf(storefront);
    if (!inStore) {
      gsap.set(storefront, { filter: PRODUCT_BLUR });
      return;
    }

    storefront.style.willChange = "filter";
    gsap.to(storefront, {
      filter: SHARP,
      duration: reducedMotion ? 0 : STOREFRONT_BLUR_DURATION,
      ease: "power3.out",
      overwrite: "auto",
      onComplete: () => {
        storefront.style.willChange = "";
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
            ? { x: -100, opacity: 0, filter: PRODUCT_BLUR }
            : { x: 0, opacity: 1, filter: SHARP },
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
