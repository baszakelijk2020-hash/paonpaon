"use client";

import type { Order, OrderLine, Product, ProductVariant } from "@paon/domain";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { formatMoney } from "@paon/utils";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

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
        <input
          ref={quantityRef}
          type="hidden"
          name="quantity"
          defaultValue={item.line.quantity}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => submitWithQuantity(item.line.quantity - 1)}
          aria-label={`Decrease quantity of ${item.product.name}`}
          style={{ minWidth: 46, height: 46 }}
          className="rounded-[var(--radius-md)] px-3 text-sm font-medium text-[var(--color-stone-900)] hover:bg-[var(--color-stone-100)] disabled:opacity-50"
        >
          −
        </button>
        <span className="min-w-8 text-center text-sm">
          {item.line.quantity}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => submitWithQuantity(item.line.quantity + 1)}
          aria-label={`Increase quantity of ${item.product.name}`}
          style={{ minWidth: 46, height: 46 }}
          className="rounded-[var(--radius-md)] px-3 text-sm font-medium text-[var(--color-stone-900)] hover:bg-[var(--color-stone-100)] disabled:opacity-50"
        >
          +
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submitWithQuantity(0)}
          aria-label={`Remove ${item.product.name} from cart`}
          style={{ minWidth: 46, height: 46 }}
          className="rounded-[var(--radius-md)] px-3 text-sm font-medium text-[var(--color-stone-900)] hover:bg-[var(--color-stone-100)] disabled:opacity-50"
        >
          Remove
        </button>
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
  const appointmentHref = `/r/${slug}/appointments`;

  // Hide floating widgets when actionable panels open to prevent covering
  // their interactive controls (filter panel, product detail, etc.).
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const classes = document.body.className;
      const shouldHide =
        classes.includes("filter-active") ||
        classes.includes("product-detail-open") ||
        classes.includes("filter-closing");
      setIsHidden(shouldHide);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Check initial state
    const classes = document.body.className;
    const shouldHide =
      classes.includes("filter-active") ||
      classes.includes("product-detail-open") ||
      classes.includes("filter-closing");
    setIsHidden(shouldHide);

    return () => observer.disconnect();
  }, []);

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
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Next step</h2>
          <p className="text-sm text-[var(--color-stone-600)]">
            Made-to-measure starts with a fitting. Book an appointment with
            these pieces in mind — card payment is not live on this demo yet.
          </p>
          <Link
            href={appointmentHref}
            className={`${buttonVariants({ className: "rounded-[15px]" })} hidden lg:inline-flex`}
          >
            Book an appointment
          </Link>
          <details className="mt-2 border-t border-[var(--color-stone-100)] pt-4">
            <summary className="cursor-pointer text-sm text-[var(--color-stone-500)]">
              Save as pending order instead
            </summary>
            <form
              ref={checkoutFormRef}
              action={action}
              className="mt-3 flex flex-col gap-3"
            >
              <input type="hidden" name="orderId" value={order.id} />
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
                <Input
                  name="city"
                  aria-label="City"
                  placeholder="City"
                  required
                />
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
                <p
                  role="alert"
                  className="text-sm text-[var(--color-danger-500)]"
                >
                  {state.formError}
                </p>
              ) : null}
              <Button
                type="submit"
                variant="secondary"
                disabled={pending}
                className="rounded-[15px]"
              >
                {pending ? "Saving…" : "Save pending order"}
              </Button>
              <p className="text-xs text-[var(--color-stone-500)]">
                No payment is collected. The order is saved as pending until
                Stripe is connected.
              </p>
            </form>
          </details>
        </div>
      </Card>

      <div
        className={`glass-panel fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-[var(--color-stone-200)] px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] transition-opacity duration-200 lg:hidden ${
          isHidden
            ? "pointer-events-none opacity-0"
            : "pointer-events-auto opacity-100"
        }`}
      >
        <div>
          <p className="text-xs uppercase text-[var(--color-stone-500)]">
            Total
          </p>
          <p className="font-medium text-[var(--color-stone-900)]">
            {formatMoney(order.total, "en-US")}
          </p>
        </div>
        <Link
          href={appointmentHref}
          className={buttonVariants({
            size: "lg",
            className: "rounded-[15px]",
          })}
        >
          Book appointment
        </Link>
      </div>
    </div>
  );
}
