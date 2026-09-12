"use client";

import gsap from "gsap";
import { type ReactNode, useLayoutEffect, useRef } from "react";

/**
 * The sidebar's category reveal, reusable: the items fade up one after
 * another at the sidebar's cadence. Used for the wardrobe's category tiles so
 * arriving in the wardrobe reads the same as opening the collection.
 */

/** The sidebar's pace exactly — see sidebar-reveal.tsx. */
const ITEM_DURATION = 0.34;
const ITEM_STEP = 0.055;
/** Nearly linear: a sharp ease front-loads the opacity and reads as a snap. */
const EASE = "power1.out";

export function StaggerReveal({
  className,
  itemSelector,
  children,
}: {
  className?: string;
  /** The elements to bring in, in the order they are painted. */
  itemSelector: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const items = Array.from(node.querySelectorAll<HTMLElement>(itemSelector));
    if (
      items.length === 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      node.classList.remove("is-pending");
      return;
    }

    // Fade only — no vertical travel. The rails used to rise 6px as they
    // faded, which read as the cards sliding up into place; in this
    // environment things come into focus where they already are.
    gsap.set(items, { autoAlpha: 0 });
    node.classList.remove("is-pending");

    const timeline = gsap.to(items, {
      autoAlpha: 1,
      duration: ITEM_DURATION,
      ease: EASE,
      // Even cadence; each item's own fade carries the ease.
      stagger: ITEM_STEP,
      clearProps: "transform,opacity,visibility",
    });

    return () => {
      timeline.kill();
    };
  }, [itemSelector]);

  return (
    <div ref={root} className={[className, "is-pending"].join(" ")}>
      {children}
    </div>
  );
}
