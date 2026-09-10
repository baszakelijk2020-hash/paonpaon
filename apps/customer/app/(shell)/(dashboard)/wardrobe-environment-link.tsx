"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { showCustomerEnvironment } from "../environment-store";

interface WardrobeEnvironmentLinkProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Reveals the already-mounted customer layer before moving to its Wardrobe
 * route, so this entry point has the identical motion as the environment
 * switcher instead of a route-first flash.
 */
export function WardrobeEnvironmentLink({
  children,
  className,
  style,
}: WardrobeEnvironmentLinkProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => {
        showCustomerEnvironment();
        router.push("/wardrobe");
      }}
    >
      {children}
    </button>
  );
}
