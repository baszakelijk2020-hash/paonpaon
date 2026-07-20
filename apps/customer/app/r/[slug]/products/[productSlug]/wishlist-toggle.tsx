"use client";

import type { ProductVariant } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Select } from "@paon/ui/components/Select";
import { useActionState, useState } from "react";

import { toggleWishlist, type ToggleWishlistState } from "./actions";

const initialToggleWishlistState: ToggleWishlistState = {};

export function WishlistToggle({
  slug,
  productSlug,
  retailerId,
  variants,
  savedVariantIds,
}: {
  slug: string;
  productSlug: string;
  retailerId: string;
  variants: readonly ProductVariant[];
  savedVariantIds: readonly string[];
}) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const boundAction = toggleWishlist.bind(null, slug, productSlug);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialToggleWishlistState,
  );
  const isSaved = savedVariantIds.includes(variantId);

  return (
    <form action={formAction} className="mt-3 flex items-center gap-2">
      <input type="hidden" name="retailerId" value={retailerId} />
      <input type="hidden" name="productVariantId" value={variantId} />
      {variants.length > 1 ? (
        <Select
          aria-label="Wishlist option"
          value={variantId}
          onChange={(event) => setVariantId(event.target.value)}
          className="w-auto text-xs"
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {[variant.size, variant.color].filter(Boolean).join(" · ") ||
                variant.sku}
            </option>
          ))}
        </Select>
      ) : null}
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={isPending || !variantId}
      >
        {isSaved ? "♥ Saved to wishlist" : "♡ Save to wishlist"}
      </Button>
      {state.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
