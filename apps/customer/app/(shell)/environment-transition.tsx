"use client";

import { gsap } from "gsap";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { usePaonEnvironment } from "./environment-store";

/** Long enough to read as a move, short enough to feel like a toggle. */
const DURATION = 0.42;

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
 * Only `transform` and `opacity` are animated, both on their own compositor
 * layer, so the move never touches layout and never blocks the main thread.
 * The blur veil is a sibling of the panel (see (shell)/layout.tsx) and is only
 * made visible for the length of the move — a full-viewport `backdrop-filter`
 * left permanently composited is the one thing here that can cost frames.
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
    const veil = document.querySelector<HTMLElement>(
      "[data-paon-customer-blur-veil]",
    );
    if (!overlay || !veil) return;

    document.body.classList.toggle("paon-storefront-active", inStore);
    overlay.setAttribute("aria-hidden", String(inStore));
    overlay.inert = inStore;

    // First paint: put the panel at the right end with no animation, or it
    // flies in from the corner on load.
    if (first.current) {
      first.current = false;
      gsap.set(overlay, { xPercent: inStore ? -100 : 0, force3D: true });
      gsap.set(veil, { opacity: 0, visibility: "hidden" });
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reducedMotion ? 0 : DURATION;

    // A switch pressed mid-switch continues from where the panel actually is,
    // rather than restarting from the far end.
    gsap.killTweensOf([overlay, veil]);

    const settle = () => {
      gsap.set(veil, { opacity: 0, visibility: "hidden" });
    };

    gsap.set(veil, { visibility: "visible" });
    gsap
      .timeline({ defaults: { overwrite: "auto" }, onComplete: settle })
      .to(
        veil,
        { opacity: 0.42, duration: duration * 0.4, ease: "power2.out" },
        0,
      )
      .to(
        overlay,
        {
          xPercent: inStore ? -100 : 0,
          duration,
          ease: "power3.inOut",
          force3D: true,
        },
        0,
      )
      .to(
        veil,
        { opacity: 0, duration: duration * 0.6, ease: "power2.in" },
        duration * 0.4,
      );
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
