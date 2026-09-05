"use client";

import { gsap } from "gsap";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { IntentPrefetchLink } from "./intent-prefetch-link";

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

const VALID_STORE_RETURN = /^\/r\/[A-Za-z0-9_-]+(?:[/?].*)?$/;

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
  const searchParams = useSearchParams();
  const inStore = pathname.startsWith("/r/");
  const returnTo = searchParams.get("returnTo");
  const activeStoreHref =
    returnTo && VALID_STORE_RETURN.test(returnTo) ? returnTo : storeHref;

  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const storeRef = useRef<HTMLAnchorElement>(null);
  const paonRef = useRef<HTMLAnchorElement>(null);
  const positioned = useRef(false);

  useLayoutEffect(() => {
    const pill = pillRef.current;
    const track = trackRef.current;
    const target = (inStore ? storeRef : paonRef).current;
    if (!pill || !track || !target) return;

    const move = () => {
      const trackBox = track.getBoundingClientRect();
      const targetBox = target.getBoundingClientRect();
      const to = {
        x: targetBox.left - trackBox.left,
        width: targetBox.width,
        height: targetBox.height,
      };

      if (!positioned.current) {
        // First paint: be where we belong, with no travel.
        positioned.current = true;
        gsap.set(pill, { ...to, autoAlpha: 1 });
        return;
      }
      gsap.to(pill, {
        ...to,
        duration: 0.42,
        // Settles without overshooting into the other half — the two segments
        // are only a few pixels apart.
        ease: "power3.out",
      });
    };

    move();

    // The labels are webfont text (GTBold3); their widths change when the font
    // finishes loading, which would otherwise leave the pill sized to the
    // fallback metrics.
    const observer = new ResizeObserver(move);
    observer.observe(track);
    return () => observer.disconnect();
  }, [inStore]);

  // Respect a reduced-motion preference: jump rather than slide.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      gsap.globalTimeline.timeScale(media.matches ? 1000 : 1);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

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
        ref={trackRef}
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
            left: 0,
            // Hidden until useLayoutEffect has measured where it belongs.
            visibility: "hidden",
            borderRadius: "999px",
            backgroundColor: "rgba(255,255,255,.055)",
            border: "1px solid rgba(255,255,255,.13)",
            boxShadow: "0 1px 1px rgba(0,0,0,.22)",
            pointerEvents: "none",
          }}
        />
        <IntentPrefetchLink
          ref={storeRef}
          href={activeStoreHref}
          className="pcs-store"
          aria-current={inStore ? "page" : undefined}
          style={{ ...SEGMENT, color: inStore ? "#e4e4e1" : "#8a8a87" }}
        >
          Store
        </IntentPrefetchLink>
        <IntentPrefetchLink
          ref={paonRef}
          href="/dashboard"
          className="pcs-mypaon"
          aria-current={inStore ? undefined : "page"}
          style={{ ...SEGMENT, color: inStore ? "#8a8a87" : "#e4e4e1" }}
        >
          My PAON
        </IntentPrefetchLink>
      </div>
    </div>
  );
}
