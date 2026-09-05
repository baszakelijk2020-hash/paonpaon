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
      offsets.set(currentPath.current, window.scrollY);
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
      const reachable =
        document.documentElement.scrollHeight >=
        remembered + window.innerHeight;
      if (reachable) window.scrollTo(0, remembered);
      const settled = reachable && Math.abs(window.scrollY - remembered) < 2;
      // ~0.5s at 60fps: long enough to outlast the router's reset, short
      // enough that a deliberate scroll during it is not fought for long.
      if (settled && frames > 6) return;
      if (frames++ > 30) return;
      raf = requestAnimationFrame(restore);
    };
    raf = requestAnimationFrame(restore);

    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}
