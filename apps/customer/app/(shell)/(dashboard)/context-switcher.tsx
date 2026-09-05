"use client";

import { usePathname } from "next/navigation";

import { IntentPrefetchLink } from "./intent-prefetch-link";

interface ContextSwitcherProps {
  /** Where the Store segment goes — the last storefront path, or its root. */
  storeHref: string;
}

const SEGMENT: React.CSSProperties = {
  fontFamily: "GTBold3, Arial, sans-serif",
  fontSize: "7px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  textDecoration: "none",
  padding: "6px 14px",
  borderRadius: "7px",
  lineHeight: 1,
  transition: "background-color 140ms ease, color 140ms ease",
  border: "1px solid transparent",
};

const ACTIVE: React.CSSProperties = {
  ...SEGMENT,
  color: "#e4e4e1",
  backgroundColor: "rgba(255,255,255,.10)",
  borderColor: "rgba(255,255,255,.16)",
  boxShadow: "0 1px 2px rgba(0,0,0,.28)",
};

const INACTIVE: React.CSSProperties = {
  ...SEGMENT,
  color: "#8a8a87",
  backgroundColor: "transparent",
};

/**
 * The Store / My PAON switcher, as a segmented control.
 *
 * Which half is current is derived from the path rather than hard-coded. The
 * sidebar is one shared component now, so the previous fixed "My PAON is
 * active" marking was wrong on the storefront — it told the visitor they were
 * in My PAON while they were browsing the Store.
 */
export function ContextSwitcher({ storeHref }: ContextSwitcherProps) {
  const pathname = usePathname();
  const inStore = pathname.startsWith("/r/");

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
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          padding: "3px",
          borderRadius: "10px",
          backgroundColor: "rgba(0,0,0,.28)",
          border: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <IntentPrefetchLink
          href={storeHref}
          className="pcs-store"
          aria-current={inStore ? "page" : undefined}
          style={inStore ? ACTIVE : INACTIVE}
        >
          Store
        </IntentPrefetchLink>
        <IntentPrefetchLink
          href="/dashboard"
          className="pcs-mypaon"
          aria-current={inStore ? undefined : "page"}
          style={inStore ? INACTIVE : ACTIVE}
        >
          My PAON
        </IntentPrefetchLink>
      </div>
    </div>
  );
}
