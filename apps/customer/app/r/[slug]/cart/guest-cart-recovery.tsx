"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
    localStorage.removeItem(key);

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
        if (res.ok) router.refresh();
      })
      .catch(() => {});
  }, [slug, router]);

  return null;
}
