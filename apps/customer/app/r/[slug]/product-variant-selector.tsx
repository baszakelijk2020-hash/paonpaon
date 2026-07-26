"use client";

import type { ProductVariant } from "@paon/domain";
import { formatMoney } from "@paon/utils";
import { useActionState, useState } from "react";

import {
  addToCart,
  type PlaceOrderFormState,
} from "./products/[productSlug]/actions";

const initialState: PlaceOrderFormState = {};

/**
 * paon.html's `.drf-selector` — a closed header row showing the current
 * variant's name/price that expands into a swatch grid on click, with a
 * crossfade between the old and new selection in the header. Ported as
 * a controlled open/closed state + CSS opacity transition rather than
 * the original's manual two-element (`-a`/`-b`) DOM crossfade, since
 * React re-renders the same node instead of swapping two.
 */
export function ProductVariantSelector({
  slug,
  productSlug,
  retailerId,
  variants,
}: {
  slug: string;
  productSlug: string;
  retailerId: string;
  variants: readonly ProductVariant[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
  const boundAddToCart = addToCart.bind(null, slug, productSlug);
  const [state, formAction, isPending] = useActionState(
    boundAddToCart,
    initialState,
  );
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  if (!selected) return null;

  return (
    <div className="rounded-[6px] border border-black/10 bg-[#1a1a1a]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-[30px] w-full items-center justify-between px-3.5 text-xs transition-opacity duration-500"
      >
        <span className="text-[#bfbfbf]">
          {[selected.size, selected.color].filter(Boolean).join(" · ") ||
            selected.sku}
        </span>
        <span className="text-[#bfbfbf]">
          {formatMoney(selected.price, "en-US")}
        </span>
      </button>
      {open && variants.length > 1 ? (
        <div className="grid grid-cols-4 gap-1.5 px-2.5 pb-3 pt-1">
          {variants.map((variant, index) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => {
                setSelectedId(variant.id);
                setOpen(false);
              }}
              style={{ transitionDelay: `${index * 60}ms` }}
              className={`rounded-[4px] border px-1 py-2 text-center text-[10px] leading-tight opacity-50 transition-opacity duration-300 hover:opacity-100 ${
                variant.id === selectedId
                  ? "border-white/70 opacity-100"
                  : "border-white/20"
              }`}
            >
              {[variant.size, variant.color].filter(Boolean).join(" ") ||
                variant.sku}
            </button>
          ))}
        </div>
      ) : null}
      <form action={formAction} className="px-3.5 pb-3.5">
        <input type="hidden" name="retailerId" value={retailerId} />
        <input type="hidden" name="productVariantId" value={selected.id} />
        <input type="hidden" name="quantity" value="1" />
        {state.formError ? (
          <p className="mb-2 text-xs text-[#f0a49d]">{state.formError}</p>
        ) : null}
        <button
          type="submit"
          disabled={isPending}
          className="mt-1 w-full rounded-[6px] bg-[linear-gradient(to_right,#595959,#333333)] py-2.5 text-sm text-[#d9d9d9] transition-opacity disabled:opacity-60"
        >
          {isPending ? "Adding…" : "Continue in-store"}
        </button>
      </form>
    </div>
  );
}
