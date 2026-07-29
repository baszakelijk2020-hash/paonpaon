"use client";

import { buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";
import { useActionState } from "react";

import { createCheckoutSession, type PayActionState } from "./actions";

const initial: PayActionState = {};

export function PayPanel({
  orderId,
  orderNumber,
  paymentCanceled,
}: {
  orderId: string;
  orderNumber: string;
  paymentCanceled: boolean;
}) {
  const [state, action, pending] = useActionState(
    createCheckoutSession,
    initial,
  );
  const payInStorePrefill = `I'd like to arrange paying in store for order ${orderNumber}.`;

  return (
    <div className="flex flex-col gap-3">
      {paymentCanceled ? (
        <p className="text-sm text-[var(--color-warning-500)]">
          Payment was canceled. Retry below, message your advisor, or arrange
          pay-in-store at your next fitting.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="orderId" value={orderId} />
          <button type="submit" disabled={pending} className={buttonVariants()}>
            {pending ? "Redirecting…" : "Retry payment"}
          </button>
        </form>
        <Link
          href={`/messages?prefill=${encodeURIComponent(payInStorePrefill)}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Message advisor
        </Link>
        <Link
          href="/appointments"
          className={buttonVariants({ variant: "ghost" })}
        >
          Pay in store
        </Link>
      </div>
      {state.formError ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
          <p className="text-sm text-[var(--color-stone-500)]">
            Online card collection may be unavailable in this environment.
            Message your advisor or book a fitting to settle in store.
          </p>
        </div>
      ) : null}
    </div>
  );
}
