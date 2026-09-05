"use client";

import { gsap } from "gsap";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { usePaonEnvironment } from "./environment-store";

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
    const hiddenTransform = "translate3d(-100%, 0, 0)";
    const visibleTransform = "translate3d(0%, 0, 0)";
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (first.current) {
      first.current = false;
      gsap.set(overlay, {
        transform: inStore ? hiddenTransform : visibleTransform,
        opacity: inStore ? 0 : 1,
      });
      gsap.set(veil, { opacity: 0 });
      return;
    }

    gsap.killTweensOf([overlay, veil]);
    const duration = reducedMotion ? 0 : 0.38;

    if (inStore) {
      gsap.to(veil, {
        opacity: 0.42,
        duration: duration * 0.55,
        ease: "power2.in",
      });
      gsap.to(overlay, {
        transform: hiddenTransform,
        opacity: 0,
        duration,
        ease: "power4.inOut",
        force3D: true,
        onComplete: () => {
          gsap.set(veil, { opacity: 0 });
        },
      });
      return;
    }

    gsap.set(veil, { opacity: 0.42 });
    gsap.fromTo(
      overlay,
      { transform: hiddenTransform, opacity: 0 },
      {
        transform: visibleTransform,
        opacity: 1,
        duration,
        ease: "power4.out",
        force3D: true,
      },
    );
    gsap.to(veil, {
      opacity: 0,
      duration: duration * 0.82,
      ease: "power2.out",
    });
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
