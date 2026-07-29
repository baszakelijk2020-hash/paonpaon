"use client";

import { useEffect, useRef } from "react";

import { mergeLocalFavorites } from "./actions";

export interface FavoritesHouse {
  slug: string;
  retailerId: string;
  variantIdByProductSlug: Record<string, string>;
}

function readFavoriteSlugIds(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * The HTML storefront (`paon-template.html`) keeps a guest's favorites in
 * `localStorage` under `paon-favorites:{slug}` — product-slug ids only,
 * since a signed-out visitor has no `Wishlist` row to write to (ADR-052:
 * that key/format is founder chrome, not renegotiable here). Once they
 * reach a signed-in portal page, this narrow hook folds those ids into
 * the real per-retailer `Wishlist` and clears the local copy so it is
 * merged exactly once.
 */
export function MergeFavorites({ houses }: { houses: FavoritesHouse[] }) {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    houses.forEach((house) => {
      const key = `paon-favorites:${house.slug}`;
      const productSlugIds = readFavoriteSlugIds(key);
      if (productSlugIds.length === 0) return;

      const variantIds = productSlugIds
        .map((productSlug) => house.variantIdByProductSlug[productSlug])
        .filter((variantId): variantId is string => Boolean(variantId));

      void (async () => {
        if (variantIds.length > 0) {
          await mergeLocalFavorites(house.retailerId, variantIds);
        }
        window.localStorage.removeItem(key);
      })();
    });
  }, [houses]);

  return null;
}
