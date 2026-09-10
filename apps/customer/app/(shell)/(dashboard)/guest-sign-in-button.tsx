"use client";

import type { CSSProperties, ReactNode } from "react";

import { showCustomerEnvironment } from "../environment-store";

/** Opens the guest customer environment without leaving the storefront. */
export function GuestSignInButton({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={showCustomerEnvironment}
      className={className}
      style={{ appearance: "none", border: 0, cursor: "pointer", ...style }}
    >
      {children}
    </button>
  );
}
