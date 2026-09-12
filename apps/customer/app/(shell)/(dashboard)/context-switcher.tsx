"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

import {
  showCustomerEnvironment,
  showStoreEnvironment,
  usePaonEnvironment,
} from "../environment-store";

interface ContextSwitcherProps {
  /** Where the Store segment goes — the last storefront path, or its root. */
  storeHref: string;
}

const SEGMENT: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "4px",
  fontFamily: "GTBold3, Arial, sans-serif",
  fontSize: "7px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  textDecoration: "none",
  padding: "8px 14px 12px",
  borderRadius: "999px",
  lineHeight: 1,
  whiteSpace: "nowrap",
  transition: "color 220ms ease",
};

/** Solid garment bag with a cut-out centre zipper. */
function ShoppingIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      style={{
        width: "14px",
        height: "14px",
        display: "block",
      }}
    >
      <path
        d="M10 1.5a2.2 2.2 0 0 0-2.2 2.2v.7L3.8 6.2v11.6h12.4V6.2L12.2 4.4v-.7A2.2 2.2 0 0 0 10 1.5Zm0 1.5c.4 0 .7.3.7.7v.2l-.7-.3-.7.3v-.2c0-.4.3-.7.7-.7ZM9.35 7.3h1.3v8.8h-1.3Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Solid wardrobe / armoire mark. */
function WardrobeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      style={{
        width: "14px",
        height: "14px",
        display: "block",
        fill: "currentColor",
      }}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 3.5h6v16H6a1 1 0 0 1-1-1V3.5Zm8 0h6v15a1 1 0 0 1-1 1h-5V3.5ZM8.9 7.5h1.3v9H8.9v-9Zm4.9 0h1.3v9h-1.3v-9Z"
      />
    </svg>
  );
}

/**
 * The Store / My PAON switcher.
 *
 * Which half is current is derived from the path, not hard-coded: the sidebar
 * is one shared component now, so a fixed "My PAON is active" told storefront
 * visitors they were somewhere they weren't.
 *
 * The lit state is a single pill element that slides between the two halves,
 * rather than a background on whichever half is active — a background can only
 * cut. Its first paint is positioned without animation (useLayoutEffect,
 * before the browser paints) so the pill does not fly in from the corner on
 * load.
 *
 * The slide is a bare CSS transform transition and deliberately NOT a GSAP
 * tween. Clicking a half starts a client navigation that swaps the whole
 * environment and re-renders the sidebar's row list, and that work blocks the
 * main thread for ~250ms — long enough to swallow most of a 320ms tween, which
 * is what the stutter on the left column was. A transform-only transition is
 * handed to the compositor, so the pill keeps moving at full frame rate while
 * the main thread is busy. Never move this back onto a JS ticker.
 */
export function ContextSwitcher({ storeHref }: ContextSwitcherProps) {
  const pathname = usePathname();
  const environment = usePaonEnvironment(pathname);
  const inStore = environment === "store";
  void storeHref;
  const pillRef = useRef<HTMLSpanElement>(null);
  const positioned = useRef(false);

  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const transform = inStore
      ? "translate3d(0%, 0, 0)"
      : "translate3d(100%, 0, 0)";
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!positioned.current) {
      positioned.current = true;
      pill.style.transition = "none";
      pill.style.transform = transform;
      pill.style.opacity = "1";
      pill.style.visibility = "visible";
      /* Flush that first, untransitioned position before arming the
         transition. Without the reflow the browser coalesces both writes into
         one style recalc and the pill slides in from 0% on load. */
      void pill.offsetWidth;
    }

    pill.style.transition = reduced
      ? "none"
      : "transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)";
    pill.style.transform = transform;
  }, [inStore]);

  return (
    <div
      id="paon-context-switcher"
      className="paon-context-switcher flex shrink-0 items-center justify-center"
      style={{
        /*
         * Flush with the header: the sidebar logo above ends at exactly
         * --header-h (60px), which is where the top menu's blurred bar ends,
         * so the toggle's own top edge must start there — no margin and no
         * top padding, or the pill floats 16px below the bar.
         */
        marginTop: "0px",
        padding: "0 25px 8px",
        background: "transparent",
      }}
    >
      <div
        role="group"
        aria-label="Switch between the store and your account"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: 0,
          padding: "3px",
          border: "none",
          borderRadius: "999px",
          background: "rgba(0,0,0,0.35)",
          // The stat tiles' one-pixel lighter rim along the top edge, so the
          // track sits in the same material as the cards beside it.
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <span
          ref={pillRef}
          data-paon-switcher-pill
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "3px",
            left: "3px",
            width: "calc(50% - 3px)",
            height: "calc(100% - 6px)",
            // useLayoutEffect reveals it at the correct end before paint.
            visibility: "hidden",
            borderRadius: "999px",
            backgroundColor: "rgba(255,255,255,.09)",
            border: "none",
            boxShadow: "none",
            pointerEvents: "none",
            willChange: "transform, opacity",
          }}
        />
        <button
          type="button"
          onClick={showStoreEnvironment}
          className="pcs-store paon-side-hover"
          aria-current={inStore ? "page" : undefined}
          style={{
            ...SEGMENT,
            width: "96px",
            color: inStore ? "#e4e4e1" : "#8a8a87",
          }}
        >
          <ShoppingIcon />
          <span style={{ position: "relative", top: "4px" }}>Store</span>
        </button>
        <button
          type="button"
          onClick={showCustomerEnvironment}
          className="pcs-mypaon paon-side-hover"
          aria-current={inStore ? undefined : "page"}
          style={{
            ...SEGMENT,
            width: "96px",
            color: inStore ? "#8a8a87" : "#e4e4e1",
          }}
        >
          <WardrobeIcon />
          <span style={{ position: "relative", top: "4px" }}>Wardrobe</span>
        </button>
      </div>
    </div>
  );
}
