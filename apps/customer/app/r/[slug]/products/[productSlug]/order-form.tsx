"use client";

import type { ProductVariant } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Select } from "@paon/ui/components/Select";
import { formatMoney } from "@paon/utils";
import { useActionState } from "react";

import { initialPlaceOrderFormState, placeOrder } from "./actions";

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
  const boundAction = placeOrder.bind(null, slug, productSlug);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialPlaceOrderFormState,
  );

  if (!isSignedIn) {
    return (
      <a
        href={`/login?redirectTo=${encodeURIComponent(`/r/${slug}/products/${productSlug}`)}`}
        className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-stone-700)]"
      >
        Sign in to purchase
      </a>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="retailerId" value={retailerId} />
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label
            htmlFor="productVariantId"
            className="mb-1 block text-sm font-medium text-[var(--color-stone-700)]"
          >
            Option
          </label>
          <Select id="productVariantId" name="productVariantId" required>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {[variant.size, variant.color].filter(Boolean).join(" · ") ||
                  variant.sku}{" "}
                — {formatMoney(variant.price, "en-US")}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-24">
          <label
            htmlFor="quantity"
            className="mb-1 block text-sm font-medium text-[var(--color-stone-700)]"
          >
            Qty
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={20}
            defaultValue={1}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 py-2 text-sm"
          />
        </div>
      </div>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Placing order…" : "Place order"}
      </Button>
      <p className="text-xs text-[var(--color-stone-500)]">
        No payment is collected yet — orders are recorded as pending payment.
      </p>
    </form>
  );
}
