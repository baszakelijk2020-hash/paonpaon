"use client";

import type { ProductVariant } from "@paon/domain";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { formatMoney } from "@paon/utils";
import Link from "next/link";
import { useActionState } from "react";

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
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <FormField label="Option" htmlFor="productVariantId">
            <Select id="productVariantId" name="productVariantId" required>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {[variant.size, variant.color].filter(Boolean).join(" · ") ||
                    variant.sku}{" "}
                  — {formatMoney(variant.price, "en-US")}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
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
