"use client";

import { useEffect } from "react";

import { attachSmoothScroll, type SmoothScroller } from "./smooth-scroll";

/**
 * Puts the carousels' eased scrolling on the two scrollers that are not React's
 * to own: the storefront grid (`main#main`, rendered from the retailer template)
 * and the category rail in the sidebar.
 *
 * Both are bound by selector rather than by ref because the storefront markup is
 * injected by the template pipeline, not rendered by this tree. An observer
 * re-binds when that markup is replaced on navigation; elements already carrying
 * the marker attribute are skipped so a re-render never stacks two handlers on
 * one element.
 */
/* Empty on purpose. Eased VERTICAL scrolling was bound here to the storefront
   grid (`main#main`) and to the sidebar's category rail, and it was not asked
   for: switching collection category then animated the grid down instead of
   simply showing it. The binder itself stays mounted for `clearIdleTransform`
   below, which other layout depends on. The appointment carousels keep their
   eased horizontal scrolling — they bind it themselves, through
   `use-smooth-carousel`, not through this list. */
const TARGETS: readonly { selector: string; axis: "x" | "y" }[] = [];

function isScrollable(node: HTMLElement, axis: "x" | "y") {
  const style = getComputedStyle(node);
  const overflow = axis === "x" ? style.overflowX : style.overflowY;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  return axis === "x"
    ? node.scrollWidth > node.clientWidth + 4
    : node.scrollHeight > node.clientHeight + 4;
}

const BOUND = "data-paon-smooth-scroll";

export function SmoothScrollBinder() {
  useEffect(() => {
    const attached = new Map<Element, SmoothScroller>();

    const bind = () => {
      for (const { selector, axis } of TARGETS) {
        for (const node of document.querySelectorAll<HTMLElement>(selector)) {
          if (node.hasAttribute(BOUND)) continue;
          if (!isScrollable(node, axis)) continue;
          node.setAttribute(BOUND, "");
          attached.set(node, attachSmoothScroll(node, axis));
        }
      }
      // A target removed from the document keeps its listeners alive through the
      // closure, so drop it as soon as it is gone.
      for (const [node, scroller] of attached) {
        if (!node.isConnected) {
          scroller.detach();
          attached.delete(node);
        }
      }
    };

    // GSAP leaves `transform: translate3d(0,0,0)` on the shell after its entrance.
    // An identity transform paints nothing, but it makes the shell the containing
    // block for every `position: fixed` descendant, so anything docked to the
    // window scrolls with the page instead. Cleared once it is identity, which by
    // definition means nothing is mid-animation.
    const clearIdleTransform = () => {
      const shell = document.querySelector<HTMLElement>(".paon-shell-content");
      if (!shell) return;
      const current = getComputedStyle(shell).transform;
      if (current === "none" || current === "matrix(1, 0, 0, 1, 0, 0)") {
        shell.style.transform = "";
      }
    };
    clearIdleTransform();

    bind();
    const observer = new MutationObserver(() => {
      bind();
      clearIdleTransform();
    });
    observer.observe(document.body, {
      attributeFilter: ["style"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      for (const [node, scroller] of attached) {
        scroller.detach();
        node.removeAttribute(BOUND);
      }
      attached.clear();
    };
  }, []);

  return null;
}
