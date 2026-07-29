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

function isVariantSoldOut(
  variant: ProductVariant,
  isMadeToOrder: boolean,
): boolean {
  return !isMadeToOrder && variant.inventoryQuantity <= 0;
}

export function OrderForm({
  slug,
  productSlug,
  retailerId,
  variants,
  isSignedIn,
  isMadeToOrder,
}: {
  slug: string;
  productSlug: string;
  retailerId: string;
  variants: readonly ProductVariant[];
  isSignedIn: boolean;
  isMadeToOrder: boolean;
}) {
  const boundAction = addToCart.bind(null, slug, productSlug);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialPlaceOrderFormState,
  );
  const firstAvailable = variants.find(
    (variant) => !isVariantSoldOut(variant, isMadeToOrder),
  );
  const [selectedVariantId, setSelectedVariantId] = useState(
    (firstAvailable ?? variants[0])?.id ?? "",
  );
  const selectedVariant = variants.find(
    (variant) => variant.id === selectedVariantId,
  );
  const selectedIsSoldOut = selectedVariant
    ? isVariantSoldOut(selectedVariant, isMadeToOrder)
    : false;

  if (!isSignedIn) {
    return (
      <Link
        href={`/login?redirectTo=${encodeURIComponent(`/r/${slug}/products/${productSlug}?legacy=1`)}`}
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
              const soldOut = isVariantSoldOut(variant, isMadeToOrder);
              return (
                <button
                  key={variant.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={soldOut}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`flex min-h-11 flex-col items-start rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors ${
                    soldOut
                      ? "cursor-not-allowed border-[var(--color-stone-200)] text-[var(--color-stone-400)] opacity-60"
                      : selected
                        ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-white"
                        : "border-[var(--color-stone-300)] text-[var(--color-stone-700)]"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {label}
                    {soldOut ? " · Sold out" : ""}
                  </span>
                  <span
                    className={`text-xs ${selected && !soldOut ? "text-white/70" : "text-[var(--color-stone-500)]"}`}
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
      {selectedIsSoldOut ? (
        <p className="text-sm text-[var(--color-stone-600)]">
          This option is sold out.{" "}
          <Link
            href={`/r/${slug}/appointments`}
            className="underline underline-offset-4"
          >
            Book a fitting
          </Link>{" "}
          to discuss availability.
        </p>
      ) : null}
      <Button type="submit" disabled={isPending || selectedIsSoldOut}>
        {isPending ? "Adding…" : "Add to cart"}
      </Button>
      <p className="text-xs text-[var(--color-stone-500)]">
        Review the full cart and shipping details before checkout.
      </p>
    </form>
  );
}
