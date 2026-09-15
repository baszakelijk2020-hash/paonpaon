"use client";

import { useEffect } from "react";

/**
 * How long the window has to hold still before the page is told it was
 * resized. Long enough to span the gap between two frames of a drag, short
 * enough that letting go of the edge feels immediate.
 */
const SETTLE_MS = 120;

/**
 * One resize event per resize, not one per frame.
 *
 * Dragging the window edge fires `resize` on every frame, and this page has
 * over twenty listeners on it — the storefront template alone re-measures its
 * feed, re-counts its grid columns, clamps every card image, re-samples the
 * header's luminance off a canvas and re-locks its spacing, some of it
 * unthrottled, most of it re-dispatching `resize` to the rest. All of that
 * ran on every frame of the drag, for both environments at once, the hidden
 * one included, and left no time to actually lay the page out. That is the
 * stutter.
 *
 * While the drag is in progress the browser's own events are swallowed here
 * before any other listener sees them, and the page resizes on CSS alone,
 * which the browser can do every frame. Once the window holds still, one
 * synthetic `resize` goes out and every listener does its work once.
 *
 * Only trusted events are held: the template and StorefrontReflow dispatch
 * their own `resize` to nudge each other, and those must keep passing.
 */
export function ResizeGate() {
  useEffect(() => {
    let timer = 0;
    const onResize = (event: Event) => {
      if (!event.isTrusted) return;
      event.stopImmediatePropagation();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, SETTLE_MS);
    };
    // Capture: at the window, capturing listeners run before the rest
    // regardless of when they were added, so this one is first in line.
    window.addEventListener("resize", onResize, { capture: true });
    return () => {
      window.removeEventListener("resize", onResize, { capture: true });
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
