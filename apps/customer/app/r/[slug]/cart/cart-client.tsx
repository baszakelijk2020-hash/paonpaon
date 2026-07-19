"use client";

import type { Order, OrderLine, Product, ProductVariant } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { formatMoney } from "@paon/utils";
import { useActionState } from "react";

import { checkoutCart, updateCartLine, type CartFormState } from "./actions";

const initial: CartFormState = {};
type CartItem = { line: OrderLine; variant: ProductVariant; product: Product };

function CartLine({ slug, item }: { slug: string; item: CartItem }) {
  const [state, action, pending] = useActionState(
    updateCartLine.bind(null, slug),
    initial,
  );
  return (
    <form
      action={action}
      className="flex items-center justify-between gap-4 border-b border-[var(--color-stone-100)] py-4 last:border-0"
    >
      <input type="hidden" name="lineId" value={item.line.id} />
      <div>
        <p className="font-medium">{item.product.name}</p>
        <p className="text-sm text-[var(--color-stone-500)]">
          {[item.variant.size, item.variant.color]
            .filter(Boolean)
            .join(" · ") || item.variant.sku}{" "}
          · {formatMoney(item.line.unitPrice, "en-US")}
        </p>
        {state.formError ? (
          <p className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Input
          className="w-20"
          name="quantity"
          type="number"
          min={0}
          max={20}
          defaultValue={item.line.quantity}
          aria-label="Quantity"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Update"}
        </Button>
      </div>
    </form>
  );
}

export function CartClient({
  slug,
  order,
  items,
}: {
  slug: string;
  order: Order;
  items: CartItem[];
}) {
  const [state, action, pending] = useActionState(
    checkoutCart.bind(null, slug),
    initial,
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <h2 className="text-lg font-medium">Items</h2>
        {items.map((item) => (
          <CartLine key={item.line.id} slug={slug} item={item} />
        ))}
        <div className="mt-4 flex justify-between font-medium">
          <span>Total</span>
          <span>{formatMoney(order.total, "en-US")}</span>
        </div>
      </Card>
      <Card>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="orderId" value={order.id} />
          <h2 className="text-lg font-medium">Shipping</h2>
          <Input name="line1" placeholder="Address" required />
          <Input name="line2" placeholder="Address line 2 (optional)" />
          <div className="grid grid-cols-2 gap-3">
            <Input name="city" placeholder="City" required />
            <Input name="region" placeholder="Region" />
            <Input name="postalCode" placeholder="Postal code" required />
            <Input
              name="countryCode"
              placeholder="Country code"
              maxLength={2}
              required
            />
          </div>
          {state.formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {state.formError}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Checking out…" : "Place order"}
          </Button>
          <p className="text-xs text-[var(--color-stone-500)]">
            No payment is collected yet. The order will be saved as pending
            payment.
          </p>
        </form>
      </Card>
    </div>
  );
}
