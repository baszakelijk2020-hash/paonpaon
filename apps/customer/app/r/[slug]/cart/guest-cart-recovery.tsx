"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    paonShowFixedBanner?: (id: string, html: string) => void;
  }
}

/**
 * Closes the loop the storefront template opens when a guest hits "Add
 * to Bag" — no guest-cart schema exists (see docs/PHASE.md), so the
 * intent is parked in `localStorage` at the point of sign-in redirect
 * instead. Once this page renders for a real customer session, replay
 * that one stored intent against the real cart and clear it.
 */
export function GuestCartRecovery({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    const key = `paon-guest-cart:${slug}`;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return;
    }
    if (!raw) return;

    let intent: { variantId?: string; kind?: string } = {};
    try {
      intent = JSON.parse(raw);
    } catch {
      return;
    }
    if (!intent.variantId) return;

    fetch(`/r/${slug}/api/cart-add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId: intent.variantId,
        kind: intent.kind,
      }),
    })
      .then((res) => {
        if (res.ok) {
          // Only clear localStorage after successful replay
          try {
            localStorage.removeItem(key);
          } catch {
            // Storage access failed, but replay succeeded; continue anyway
          }
          router.refresh();
          return;
        }
        // Handle non-2xx error responses
        res
          .json()
          .then((data) => {
            const errorMsg =
              data && data.error
                ? data.error
                : "Failed to add your saved item to the cart. Please try again.";
            if (typeof window.paonShowFixedBanner === "function") {
              window.paonShowFixedBanner(
                "paon-recovery-error-banner",
                errorMsg,
              );
            }
          })
          .catch(() => {
            if (typeof window.paonShowFixedBanner === "function") {
              window.paonShowFixedBanner(
                "paon-recovery-error-banner",
                "Failed to add your saved item to the cart. Please try again.",
              );
            }
          });
      })
      .catch(() => {
        // Network error — preserve localStorage so item isn't lost
        if (typeof window.paonShowFixedBanner === "function") {
          window.paonShowFixedBanner(
            "paon-recovery-network-error-banner",
            "Connection failed. Your saved item is still waiting in your bag.",
          );
        }
      });
  }, [slug, router]);

  return null;
}
