"use client";

import { Button, buttonVariants } from "@paon/ui/components/Button";
import { Input } from "@paon/ui/components/Input";
import Link from "next/link";
import { useActionState, useTransition, useState } from "react";

import {
  choosePayAtDelivery,
  createCheckoutSession,
  simulateDemoPayment,
  type PayActionState,
} from "./actions";

const initial: PayActionState = {};

export function PayPanel({
  orderId,
  orderNumber,
  paymentCanceled,
  payAtDelivery,
  canOfferPayAtDelivery,
  demoPaymentsEnabled,
  stripeConfigured,
}: {
  orderId: string;
  orderNumber: string;
  paymentCanceled: boolean;
  payAtDelivery: boolean;
  canOfferPayAtDelivery: boolean;
  demoPaymentsEnabled: boolean;
  stripeConfigured: boolean;
}) {
  const [state, action, pending] = useActionState(
    createCheckoutSession,
    initial,
  );
  const [demoState, demoAction, demoPending] = useActionState(
    simulateDemoPayment,
    initial,
  );
  const [isChoosingPayAtDelivery, startChoosingPayAtDelivery] = useTransition();
  const [showDemoForm, setShowDemoForm] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const payInStorePrefill = `I'd like to arrange paying in store for order ${orderNumber}.`;

  // Known server-side up front (env.stripeSecretKey presence) rather than
  // inferred from state.formError -- that only exists AFTER a real-Stripe
  // submit attempt, so a first-time visitor would see "Retry payment" (an
  // unconfigured Stripe path that silently fails) before ever seeing the
  // demo option, defeating the point of a frictionless demo checkout.
  const isNotConfiguredError = !stripeConfigured;
  const canOfferDemoPayment = isNotConfiguredError && demoPaymentsEnabled;

  if (payAtDelivery) {
    return (
      <p className="text-sm text-[var(--color-stone-600)]">
        You chose to pay at delivery — no online charge has been attempted.
        You&rsquo;ll settle when your order is ready to collect.
      </p>
    );
  }

  // Demo payment form (only shown when Stripe isn't configured and demo mode is explicitly enabled)
  if (canOfferDemoPayment && showDemoForm) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-[var(--color-warning-300)] bg-[var(--color-warning-50)] p-4">
          <p className="text-sm font-medium text-[var(--color-warning-900)]">
            You are in a demo experience
          </p>
          <p className="mt-1 text-sm text-[var(--color-warning-800)]">
            This is purely for demo purposes — no real transactions are made
            now. Please do not fill in your real payment details.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-[var(--color-stone-200)] p-4">
          <div>
            <label
              htmlFor="cardNumber"
              className="block text-sm font-medium text-[var(--color-stone-900)]"
            >
              Card number
            </label>
            <Input
              id="cardNumber"
              type="text"
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))
              }
              disabled={demoPending}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cardExpiry"
                className="block text-sm font-medium text-[var(--color-stone-900)]"
              >
                Expiry (MM/YY)
              </label>
              <Input
                id="cardExpiry"
                type="text"
                placeholder="12/25"
                value={cardExpiry}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  let value = e.target.value.replace(/\D/g, "").slice(0, 4);
                  if (value.length >= 2) {
                    value = value.slice(0, 2) + "/" + value.slice(2);
                  }
                  setCardExpiry(value);
                }}
                disabled={demoPending}
                className="mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="cardCvc"
                className="block text-sm font-medium text-[var(--color-stone-900)]"
              >
                CVC
              </label>
              <Input
                id="cardCvc"
                type="text"
                placeholder="123"
                value={cardCvc}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                disabled={demoPending}
                className="mt-1"
              />
            </div>
          </div>

          {demoState.formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {demoState.formError}
            </p>
          ) : null}

          <div className="flex gap-2 pt-2">
            <form action={demoAction} className="flex-1">
              <input type="hidden" name="orderId" value={orderId} />
              <button
                type="submit"
                disabled={demoPending}
                className={buttonVariants()}
              >
                {demoPending ? "Processing…" : "Pay"}
              </button>
            </form>
            <Button
              type="button"
              variant="outline"
              disabled={demoPending}
              onClick={() => setShowDemoForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show demo option or standard payment flow
  return (
    <div className="flex flex-col gap-3">
      {paymentCanceled ? (
        <p className="text-sm text-[var(--color-warning-500)]">
          Payment was canceled. Retry below, message your advisor, or arrange
          pay-in-store at your next fitting.
        </p>
      ) : null}

      {canOfferDemoPayment && !showDemoForm ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-stone-600)]">
            You are in a demo experience — payment processing is simulated here.
            No real transactions are made.
          </p>
          <button
            onClick={() => setShowDemoForm(true)}
            className={buttonVariants()}
          >
            Enter demo payment
          </button>
        </div>
      ) : isNotConfiguredError && !demoPaymentsEnabled ? (
        <p className="text-sm text-[var(--color-stone-600)]">
          Online payment isn&rsquo;t configured for this retailer yet. Message
          your advisor or arrange pay-in-store instead.
        </p>
      ) : !isNotConfiguredError ? (
        <div className="flex flex-wrap gap-2">
          <form action={action}>
            <input type="hidden" name="orderId" value={orderId} />
            <button
              type="submit"
              disabled={pending}
              className={buttonVariants()}
            >
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
          {canOfferPayAtDelivery ? (
            <Button
              type="button"
              variant="ghost"
              disabled={isChoosingPayAtDelivery}
              onClick={() =>
                startChoosingPayAtDelivery(async () => {
                  await choosePayAtDelivery(orderId);
                })
              }
            >
              {isChoosingPayAtDelivery ? "Saving…" : "Pay at delivery instead"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {state.formError && !isNotConfiguredError ? (
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
