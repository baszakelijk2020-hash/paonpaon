"use client";

import type { Order, OrderLine, Product, ProductVariant } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { formatMoney } from "@paon/utils";
import { useActionState, useRef } from "react";

import { checkoutCart, updateCartLine, type CartFormState } from "./actions";

const initial: CartFormState = {};
type CartItem = { line: OrderLine; variant: ProductVariant; product: Product };

function CartLine({ slug, item }: { slug: string; item: CartItem }) {
  const [state, action, pending] = useActionState(
    updateCartLine.bind(null, slug),
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);

  function submitWithQuantity(nextQuantity: number) {
    if (quantityRef.current) {
      quantityRef.current.value = String(Math.max(0, nextQuantity));
    }
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
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
        <div className="flex items-center rounded-[var(--radius-sm)] border border-[var(--color-stone-300)]">
          <button
            type="button"
            aria-label={`Decrease quantity of ${item.product.name}`}
            disabled={pending}
            onClick={() => submitWithQuantity(item.line.quantity - 1)}
            className="flex h-11 w-11 items-center justify-center text-lg text-[var(--color-stone-700)] active:scale-90 disabled:opacity-50 motion-reduce:active:scale-100"
          >
            −
          </button>
          <Input
            ref={quantityRef}
            className="h-11 w-12 border-x border-y-0 text-center [appearance:textfield]"
            name="quantity"
            type="number"
            min={0}
            max={20}
            defaultValue={item.line.quantity}
            aria-label={`Quantity of ${item.product.name}`}
            readOnly
          />
          <button
            type="button"
            aria-label={`Increase quantity of ${item.product.name}`}
            disabled={pending}
            onClick={() => submitWithQuantity(item.line.quantity + 1)}
            className="flex h-11 w-11 items-center justify-center text-lg text-[var(--color-stone-700)] active:scale-90 disabled:opacity-50 motion-reduce:active:scale-100"
          >
            +
          </button>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => submitWithQuantity(0)}
          aria-label={`Remove ${item.product.name} from cart`}
          className="h-11 min-w-11"
        >
          Remove
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
  const checkoutFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="paon-reveal">
        <h2 className="text-lg font-medium">Items</h2>
        {items.map((item) => (
          <CartLine key={item.line.id} slug={slug} item={item} />
        ))}
        <div className="mt-4 flex justify-between font-medium">
          <span>Total</span>
          <span>{formatMoney(order.total, "en-US")}</span>
        </div>
      </Card>
      <Card className="paon-reveal" style={{ animationDelay: "120ms" }}>
        <form
          ref={checkoutFormRef}
          action={action}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="orderId" value={order.id} />
          <h2 className="text-lg font-medium">Shipping</h2>
          <Input
            name="line1"
            aria-label="Address"
            placeholder="Address"
            required
          />
          <Input
            name="line2"
            aria-label="Address line 2 (optional)"
            placeholder="Address line 2 (optional)"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input name="city" aria-label="City" placeholder="City" required />
            <Input name="region" aria-label="Region" placeholder="Region" />
            <Input
              name="postalCode"
              aria-label="Postal code"
              placeholder="Postal code"
              required
            />
            <Input
              name="countryCode"
              aria-label="Country code"
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
          <Button
            type="submit"
            disabled={pending}
            className="hidden lg:inline-flex"
          >
            {pending ? "Checking out…" : "Place order"}
          </Button>
          <p className="text-xs text-[var(--color-stone-500)]">
            No payment is collected yet. The order will be saved as pending
            payment.
          </p>
        </form>
      </Card>

      <div className="glass-panel fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-[var(--color-stone-200)] px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden">
        <div>
          <p className="text-xs uppercase text-[var(--color-stone-500)]">
            Total
          </p>
          <p className="font-medium text-[var(--color-stone-900)]">
            {formatMoney(order.total, "en-US")}
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          disabled={pending}
          onClick={() => checkoutFormRef.current?.requestSubmit()}
        >
          {pending ? "Checking out…" : "Place order"}
        </Button>
      </div>
    </div>
  );
}
