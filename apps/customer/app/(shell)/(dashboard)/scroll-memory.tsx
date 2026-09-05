"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Returns the visitor to where they were on a page they have already visited.
 *
 * Next restores scroll for browser back/forward, but a link navigation always
 * lands at the top — so leaving My PAON for the store and coming back put the
 * visitor at the top of a page they were halfway down. This remembers the
 * offset per path for the session and puts it back, the same promise the
 * storefront's live-DOM cache makes on the other side of the switch.
 *
 * Session-scoped and in memory on purpose: it is about not losing your place
 * while moving around, not restoring a position days later.
 */
const offsets = new Map<string, number>();

/**
 * What actually scrolls.
 *
 * The customer environment is a fixed overlay above the parked storefront
 * (.paon-shell-content), so it scrolls itself rather than the window. Reading
 * window.scrollY here returned 0 for every page.
 */
function scroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".paon-shell-content");
}

export function ScrollMemory() {
  const pathname = usePathname();
  // Read by the click handler, which is registered once and must always see
  // the path the visitor is leaving rather than the one it closed over.
  const currentPath = useRef(pathname);
  currentPath.current = pathname;

  /*
   * The offset is captured when a link is clicked, not while scrolling and not
   * on the way out.
   *
   * Recording during scroll looks right and is not: as the router leaves, it
   * scrolls the outgoing page to the top, and that scroll event overwrites the
   * stored offset with 0 before the effect is cleaned up — every position came
   * back 0. A click is the moment the visitor decides to leave, before
   * anything has moved.
   */
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      const el = scroller();
      offsets.set(currentPath.current, el ? el.scrollTop : window.scrollY);
    }
    // Pointerdown, not click: it precedes any handler that might navigate.
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  useEffect(() => {
    const remembered = offsets.get(pathname);
    if (!remembered) return;

    /*
     * Re-apply for a short window rather than scrolling once.
     *
     * Two things fight the restore: Server Components stream in, so the page
     * can be shorter than its final height for a few frames; and the router
     * scrolls the new page to the top *after* this effect runs, which silently
     * undid a single scrollTo. Reasserting until it holds settles both.
     */
    let frames = 0;
    let raf = 0;
    const restore = () => {
      const el = scroller();
      const height = el
        ? el.scrollHeight
        : document.documentElement.scrollHeight;
      const view = el ? el.clientHeight : window.innerHeight;
      const reachable = height >= remembered + view;
      if (reachable) {
        if (el) el.scrollTop = remembered;
        else window.scrollTo(0, remembered);
      }
      const here = el ? el.scrollTop : window.scrollY;
      const settled = reachable && Math.abs(here - remembered) < 2;
      /*
       * Hold the offset for a beat after it first sticks, not only until it
       * sticks: Server Components stream in after the restore, and the growth
       * that causes otherwise lands the page back at the top a few frames
       * later.
       */
      if (settled && frames > 40) return;
      if (frames++ > 90) return;
      raf = requestAnimationFrame(restore);
    };
    raf = requestAnimationFrame(restore);

    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}
