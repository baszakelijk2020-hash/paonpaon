"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

import { attachSmoothScroll, type SmoothScroller } from "../smooth-scroll";

/**
 * Eased horizontal scrolling for the appointment carousels, plus arrow paging on
 * the same curve. The mechanics live in `attachSmoothScroll`; this is the React
 * binding around them.
 */
export function useSmoothCarousel(ref: RefObject<HTMLDivElement | null>) {
  const scroller = useRef<SmoothScroller | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    scroller.current = attachSmoothScroll(element, "x");
    return () => {
      scroller.current?.detach();
      scroller.current = null;
    };
  }, [ref]);

  return useCallback((direction: "left" | "right", amount: number) => {
    scroller.current?.nudge(direction === "left" ? -amount : amount);
  }, []);
}
