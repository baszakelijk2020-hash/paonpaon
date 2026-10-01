"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/** Opens authentication while the Wardrobe preview remains guest-accessible. */
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
    <Link
      href="/login?redirectTo=%2Fdashboard"
      className={className}
      style={{ cursor: "pointer", ...style }}
    >
      {children}
    </Link>
  );
}
