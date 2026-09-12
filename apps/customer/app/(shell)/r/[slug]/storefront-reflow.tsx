"use client";

import { useEffect } from "react";

/**
 * The storefront template lays its feed out by measuring, then pinning the
 * result: `.home-masonry-column` gets a pixel `height`, `min-height` and
 * `overflow: hidden`, and each card gets a pixel `height`/`max-height`/
 * `flex-basis`. Twenty-four separate resize handlers re-run those passes, and
 * several guard themselves with an "already running" flag. When two of them
 * overlap — which a slow frame during a window drag is enough to cause — a
 * pass can be skipped while the pins from the old viewport stay, and the feed
 * keeps the height it had before: content cut off at the bottom of a window
 * that has since grown.
 *
 * This clears those pins once a resize has settled and asks the template to
 * measure again, so a missed pass cannot leave stale geometry behind. It
 * never fights the template's own layout: it only removes values the template
 * itself will write again on the pass it triggers.
 */

const PINNED = [
  ".home-masonry-column",
  ".home-feed-card",
  "#detail-main",
  ".detail-main",
].join(", ");

/** Only geometry the template pins; nothing it sets once and relies on. */
const PINNED_PROPERTIES = [
  "height",
  "min-height",
  "max-height",
  "flex-basis",
  "overflow",
  "width",
  "max-width",
];

const SETTLE_MS = 180;

export function StorefrontReflow() {
  useEffect(() => {
    let timer = 0;
    // The re-measure is asked for with a resize event, which this listener
    // would otherwise hear as a new resize.
    let asking = false;

    const remeasure = () => {
      document.querySelectorAll<HTMLElement>(PINNED).forEach((element) => {
        for (const property of PINNED_PROPERTIES) {
          element.style.removeProperty(property);
        }
      });
      asking = true;
      window.dispatchEvent(new Event("resize"));
      asking = false;
    };

    const onResize = () => {
      if (asking) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(remeasure, SETTLE_MS);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
