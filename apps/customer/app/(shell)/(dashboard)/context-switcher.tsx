"use client";

import { gsap } from "gsap";
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
 * The lit state is a single pill element that GSAP slides between the two
 * halves, rather than a background on whichever half is active — a background
 * can only cut, and the founder's template animates everything else on the
 * page with GSAP, so this matches it. Its first paint is positioned without
 * animation (useLayoutEffect, before the browser paints) so the pill does not
 * fly in from the corner on load.
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
    if (!positioned.current) {
      positioned.current = true;
      gsap.set(pill, { transform, opacity: 1, visibility: "visible" });
      return;
    }
    gsap.to(pill, {
      transform,
      opacity: 1,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 0.32,
      ease: "power3.out",
      force3D: true,
    });
  }, [inStore]);

  return (
    <div
      id="paon-context-switcher"
      className="paon-context-switcher flex shrink-0 items-center justify-center"
      style={{
        marginTop: "20px",
        padding: "14px 25px",
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
          className="pcs-store"
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
          className="pcs-mypaon"
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
