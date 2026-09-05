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
  fontFamily: "GTBold3, Arial, sans-serif",
  fontSize: "7px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  textDecoration: "none",
  padding: "7px 16px",
  borderRadius: "999px",
  lineHeight: 1,
  transition: "color 220ms ease",
};

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
      gsap.set(pill, { transform, opacity: 1 });
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
        padding: "14px 25px",
        background:
          "linear-gradient(to right, rgba(255,255,255,.045), rgba(255,255,255,0)), linear-gradient(to right, #262626, #1d1d1d)",
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
          borderRadius: "999px",
          backgroundColor: "rgba(0,0,0,.30)",
          border: "none",
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
            // Hidden until useLayoutEffect has measured where it belongs.
            visibility: "hidden",
            borderRadius: "999px",
            backgroundColor: "rgba(255,255,255,.055)",
            border: "1px solid rgba(255,255,255,.13)",
            boxShadow: "0 1px 1px rgba(0,0,0,.22)",
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
            width: "76px",
            color: inStore ? "#e4e4e1" : "#8a8a87",
          }}
        >
          Store
        </button>
        <button
          type="button"
          onClick={showCustomerEnvironment}
          className="pcs-mypaon"
          aria-current={inStore ? undefined : "page"}
          style={{
            ...SEGMENT,
            width: "76px",
            color: inStore ? "#8a8a87" : "#e4e4e1",
          }}
        >
          My PAON
        </button>
      </div>
    </div>
  );
}
