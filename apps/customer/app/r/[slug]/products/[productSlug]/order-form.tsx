"use client";

import type { ProductVariant } from "@paon/domain";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { formatMoney } from "@paon/utils";
import Link from "next/link";
import { useActionState, useState } from "react";

import { addToCart, type PlaceOrderFormState } from "./actions";

const initialPlaceOrderFormState: PlaceOrderFormState = {};

export function OrderForm({
  slug,
  productSlug,
  retailerId,
  variants,
  isSignedIn,
}: {
  slug: string;
  productSlug: string;
  retailerId: string;
  variants: readonly ProductVariant[];
  isSignedIn: boolean;
}) {
  const boundAction = addToCart.bind(null, slug, productSlug);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialPlaceOrderFormState,
  );
  const [selectedVariantId, setSelectedVariantId] = useState(
    variants[0]?.id ?? "",
  );

  if (!isSignedIn) {
    return (
      <Link
        href={`/login?redirectTo=${encodeURIComponent(`/r/${slug}/products/${productSlug}`)}`}
        className={buttonVariants({ className: "w-full justify-center" })}
      >
        Sign in to purchase
      </Link>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="retailerId" value={retailerId} />
      <input type="hidden" name="productVariantId" value={selectedVariantId} />
      {variants.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-[var(--color-stone-700)]">
            Option
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {variants.map((variant) => {
              const label =
                [variant.size, variant.color].filter(Boolean).join(" · ") ||
                variant.sku;
              const selected = selectedVariantId === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`flex min-h-11 flex-col items-start rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors ${
                    selected
                      ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-white"
                      : "border-[var(--color-stone-300)] text-[var(--color-stone-700)]"
                  }`}
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span
                    className={`text-xs ${selected ? "text-white/70" : "text-[var(--color-stone-500)]"}`}
                  >
                    {formatMoney(variant.price, "en-US")}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <div className="flex items-end gap-3">
        <div className="w-24">
          <FormField label="Qty" htmlFor="quantity">
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              max={20}
              defaultValue={1}
            />
          </FormField>
        </div>
      </div>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add to cart"}
      </Button>
      <p className="text-xs text-[var(--color-stone-500)]">
        Review the full cart and shipping details before checkout.
      </p>
    </form>
  );
}
