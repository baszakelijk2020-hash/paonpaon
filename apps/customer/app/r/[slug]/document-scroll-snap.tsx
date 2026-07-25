"use client";

import { useEffect } from "react";

/**
 * Applies scroll-snap to the actual document scroller (`html`) instead of
 * an inner div. A page-local `<main className="h-[100dvh] overflow-y-scroll">`
 * looks identical but never lets `document`/`body` scroll — mobile Safari
 * and Chrome only auto-hide their address bar when the real page scrolls,
 * so that approach silently breaks the "feels like an app" effect the
 * founder asked for. Toggled on mount/off on unmount so it never leaks
 * into other routes that don't want snap sections.
 */
export function DocumentScrollSnap() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("snap-y", "snap-mandatory", "scroll-smooth");
    return () => {
      root.classList.remove("snap-y", "snap-mandatory", "scroll-smooth");
    };
  }, []);
  return null;
}
