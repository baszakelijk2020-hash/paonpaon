"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { createCheckoutSession, type PayActionState } from "./actions";

const initial: PayActionState = {};

export function PayPanel({
  orderId,
  paymentCanceled,
}: {
  orderId: string;
  paymentCanceled: boolean;
}) {
  const [state, action, pending] = useActionState(
    createCheckoutSession,
    initial,
  );

  return (
    <div className="flex flex-col gap-2">
      {paymentCanceled ? (
        <p className="text-sm text-[var(--color-warning-500)]">
          Payment was canceled — you can try again below.
        </p>
      ) : null}
      <form action={action}>
        <input type="hidden" name="orderId" value={orderId} />
        <Button type="submit" disabled={pending}>
          {pending ? "Redirecting…" : "Pay now"}
        </Button>
      </form>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </div>
  );
}
