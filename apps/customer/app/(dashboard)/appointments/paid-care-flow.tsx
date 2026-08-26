"use client";

import type {
  PaidCareFulfilmentMethod,
  PaidCarePaymentChoice,
  PaidCareServiceKind,
} from "@paon/domain";
import { PAID_CARE_SERVICE_KIND_LABELS } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import Image from "next/image";
import { useActionState, useState } from "react";

import {
  createPaidCareBooking,
  type PaidCareBookingState,
} from "./paid-care-actions";

export interface PricedOperation {
  readonly code: string;
  readonly label: string;
  readonly amountMinorUnits: number;
  readonly currency: string;
}

function formatMoney(amountMinorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    amountMinorUnits / 100,
  );
}

type Step =
  | "alteration_branch"
  | "operation"
  | "quantity"
  | "pickup"
  | "return"
  | "review"
  | "payment"
  | "confirmed";

/** §6.1 alteration decision branches. The retailer reads which one the
 * customer chose from the booking note prefix. */
type AlterationBranch = "know_exact" | "advisor_self_scan" | "assess_in_store";

const ALTERATION_BRANCHES: readonly {
  readonly value: AlterationBranch;
  readonly label: string;
  readonly detail: string;
}[] = [
  {
    value: "know_exact",
    label: "I know exactly what needs changing",
    detail: "Pick the priced operations yourself.",
  },
  {
    value: "advisor_self_scan",
    label: "Ask advisor with self-scan",
    detail: "Describe the fit and let your advisor assess it.",
  },
  {
    value: "assess_in_store",
    label: "Assess in store",
    detail: "Bring the garment in; your advisor prices it with you.",
  },
];

const FULFILMENT_METHODS: readonly PaidCareFulfilmentMethod[] = [
  "home",
  "office",
  "store",
];

const initialState: PaidCareBookingState = { fieldErrors: {} };

export function PaidCareFlow({
  retailerId,
  serviceKind,
  operations,
  onCloseAction,
}: {
  retailerId: string;
  serviceKind: PaidCareServiceKind;
  operations: readonly PricedOperation[];
  onCloseAction: () => void;
}) {
  const isAlteration = serviceKind === "alteration";
  const firstNonBranchStep: Step =
    operations.length === 0 ? "quantity" : "operation";
  const [step, setStep] = useState<Step>(
    isAlteration ? "alteration_branch" : firstNonBranchStep,
  );
  const [branch, setBranch] = useState<AlterationBranch | null>(null);
  const [serviceNote, setServiceNote] = useState("");
  const [operationCode, setOperationCode] = useState<string | null>(
    operations.length === 0 ? "unspecified" : null,
  );
  const [garmentDescription, setGarmentDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [pickupMethod, setPickupMethod] =
    useState<PaidCareFulfilmentMethod | null>(null);
  const [returnMethod, setReturnMethod] =
    useState<PaidCareFulfilmentMethod | null>(null);
  const [paymentChoice, setPaymentChoice] =
    useState<PaidCarePaymentChoice | null>(null);
  const [state, formAction, isPending] = useActionState(
    createPaidCareBooking,
    initialState,
  );

  const operation = operations.find((op) => op.code === operationCode) ?? null;
  const total = operation
    ? formatMoney(operation.amountMinorUnits * quantity, operation.currency)
    : null;
  const assessInStore = branch === "assess_in_store";

  // The booking note the retailer receives — branch-tagged so the chosen
  // decision path (and, for the folded-price branches, the customer's own
  // words) survive into the work order.
  const bookingNote = (
    branch === "assess_in_store"
      ? `[Assess in store] Please have the garment brought to the store for assessment. ${serviceNote}`
      : branch === "advisor_self_scan"
        ? `[Advisor self-scan] ${serviceNote}`
        : serviceNote
  ).trim();

  function priceList() {
    return operations.length > 0 ? (
      <ul className="mt-2 flex flex-col gap-1 text-xs text-[var(--color-stone-300)]">
        {operations.map((op) => (
          <li key={op.code} className="flex justify-between">
            <span>{op.label}</span>
            <span>{formatMoney(op.amountMinorUnits, op.currency)}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-2 text-xs text-[var(--color-stone-400)]">
        Your advisor confirms the price with you in store.
      </p>
    );
  }

  if (state.success) {
    return (
      <div className="flex flex-col gap-3 rounded-[15px] bg-[var(--color-stone-900)] p-6 text-white">
        <p className="font-display text-xl">Care request booked</p>
        {state.totalLabel ? (
          <p className="text-sm text-[var(--color-stone-300)]">
            {state.totalLabel}
            {paymentChoice === "pay_now"
              ? " — authorized in this demo environment."
              : " — due at pickup."}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-stone-300)]">
            Your advisor will confirm the exact price.
          </p>
        )}
        {state.qrDataUrl ? (
          <div className="flex flex-col items-center gap-2 rounded-[10px] bg-white p-4">
            <Image
              src={state.qrDataUrl}
              alt="Store pickup QR code"
              width={180}
              height={180}
              unoptimized
            />
            <p className="text-xs text-[var(--color-stone-600)]">
              Show this at pickup.
            </p>
          </div>
        ) : null}
        <Button size="sm" onClick={onCloseAction} className="self-start">
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[15px] bg-[var(--color-stone-900)] p-6 text-white">
      <div className="flex items-center justify-between">
        <p className="font-display text-xl">
          {PAID_CARE_SERVICE_KIND_LABELS[serviceKind]}
        </p>
        <button
          type="button"
          onClick={onCloseAction}
          className="text-xs text-[var(--color-stone-400)] underline"
        >
          Cancel
        </button>
      </div>

      {step === "alteration_branch" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-stone-300)]">
            How would you like to handle this alteration?
          </p>
          <div className="flex flex-col gap-2">
            {ALTERATION_BRANCHES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                aria-label={choice.label}
                onClick={() => {
                  setBranch(choice.value);
                  setStep(
                    choice.value === "know_exact"
                      ? firstNonBranchStep
                      : "quantity",
                  );
                }}
                className="rounded-[10px] bg-white/[0.06] px-4 py-3 text-left text-sm"
              >
                <span className="block font-medium">{choice.label}</span>
                <span className="block text-xs text-[var(--color-stone-400)]">
                  {choice.detail}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === "operation" && operations.length > 0 ? (
        <div className="flex flex-col gap-2">
          {operations.map((op) => (
            <button
              key={op.code}
              type="button"
              onClick={() => {
                setOperationCode(op.code);
                setStep("quantity");
              }}
              className="flex items-center justify-between rounded-[10px] bg-white/[0.06] px-4 py-3 text-left text-sm"
            >
              <span>{op.label}</span>
              <span className="text-[var(--color-stone-300)]">
                {formatMoney(op.amountMinorUnits, op.currency)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {step === "quantity" ? (
        <div className="flex flex-col gap-3">
          {assessInStore || branch === "advisor_self_scan" ? (
            <label className="text-sm text-[var(--color-stone-300)]">
              {assessInStore
                ? "What should we look at? (a short note)"
                : "Describe the fit for your advisor"}
              <textarea
                value={serviceNote}
                onChange={(event) => setServiceNote(event.target.value)}
                rows={3}
                maxLength={800}
                placeholder={
                  assessInStore
                    ? "e.g. jacket sleeves feel long, trousers a touch loose at the waist"
                    : "e.g. the shoulders pull when I reach forward"
                }
                className="mt-1 block w-full rounded-[10px] bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-[var(--color-stone-500)]"
              />
            </label>
          ) : null}
          {assessInStore ? (
            <div className="rounded-[10px] bg-white/[0.06] p-3 text-xs text-[var(--color-stone-300)]">
              <p>Please bring the garment to the store for assessment.</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-[var(--color-stone-400)]">
                  Price list
                </summary>
                {priceList()}
              </details>
            </div>
          ) : null}
          <label className="text-sm text-[var(--color-stone-300)]">
            Garment
            <input
              value={garmentDescription}
              onChange={(event) => setGarmentDescription(event.target.value)}
              placeholder="Navy suit"
              className="mt-1 block w-full rounded-[10px] bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-[var(--color-stone-500)]"
            />
          </label>
          <label className="text-sm text-[var(--color-stone-300)]">
            Quantity
            <input
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(event) =>
                setQuantity(Math.max(1, Number(event.target.value) || 1))
              }
              className="mt-1 block w-24 rounded-[10px] bg-white/[0.06] px-3 py-2 text-sm text-white"
            />
          </label>
          <Button
            size="sm"
            disabled={garmentDescription.trim().length === 0}
            onClick={() => setStep("pickup")}
            className="self-start"
          >
            Continue
          </Button>
        </div>
      ) : null}

      {step === "pickup" ? (
        <div className="flex flex-col gap-2">
          {FULFILMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => {
                setPickupMethod(method);
                setStep("return");
              }}
              className="rounded-[10px] bg-white/[0.06] px-4 py-3 text-left text-sm capitalize"
            >
              {method === "store" ? "Store drop-off" : `${method} pickup`}
            </button>
          ))}
        </div>
      ) : null}

      {step === "return" ? (
        <div className="flex flex-col gap-2">
          {FULFILMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => {
                setReturnMethod(method);
                setStep("review");
              }}
              className="rounded-[10px] bg-white/[0.06] px-4 py-3 text-left text-sm capitalize"
            >
              {method === "store" ? "Store pickup" : `${method} delivery`}
            </button>
          ))}
        </div>
      ) : null}

      {step === "review" ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-[10px] bg-white/[0.06] p-4 text-sm">
            <p>{garmentDescription}</p>
            {operation ? (
              <p className="text-[var(--color-stone-300)]">{operation.label}</p>
            ) : assessInStore ? (
              <p className="text-[var(--color-stone-300)]">
                Assessed and priced with you in store.
              </p>
            ) : branch === "advisor_self_scan" ? (
              <p className="text-[var(--color-stone-300)]">
                Your advisor assesses this from your description.
              </p>
            ) : (
              <p className="text-[var(--color-stone-300)]">
                Price confirmed by your advisor.
              </p>
            )}
            {serviceNote.trim() ? (
              <p className="mt-1 text-[var(--color-stone-400)]">
                “{serviceNote.trim()}”
              </p>
            ) : null}
            <p className="text-[var(--color-stone-300)]">
              {pickupMethod} pickup · {returnMethod} return
            </p>
            {total ? <p className="mt-2 font-medium">{total}</p> : null}
            {assessInStore ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-[var(--color-stone-400)]">
                  Price list
                </summary>
                {priceList()}
              </details>
            ) : null}
          </div>
          <Button
            size="sm"
            onClick={() => setStep("payment")}
            className="self-start"
          >
            Continue
          </Button>
        </div>
      ) : null}

      {step === "payment" ? (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="retailerId" value={retailerId} />
          <input type="hidden" name="serviceKind" value={serviceKind} />
          <input
            type="hidden"
            name="garmentDescription"
            value={garmentDescription}
          />
          <input type="hidden" name="quantity" value={quantity} />
          {operationCode && operationCode !== "unspecified" ? (
            <input type="hidden" name="operationCode" value={operationCode} />
          ) : null}
          <input type="hidden" name="pickupMethod" value={pickupMethod ?? ""} />
          <input type="hidden" name="returnMethod" value={returnMethod ?? ""} />
          {bookingNote ? (
            <input type="hidden" name="notes" value={bookingNote} />
          ) : null}

          <button
            type="button"
            onClick={() => setPaymentChoice("pay_at_pickup")}
            className={`rounded-[10px] px-4 py-3 text-left text-sm ${
              paymentChoice === "pay_at_pickup"
                ? "bg-white text-[var(--color-stone-900)]"
                : "bg-white/[0.06]"
            }`}
          >
            Pay at pickup
          </button>
          <button
            type="button"
            onClick={() => setPaymentChoice("pay_now")}
            className={`rounded-[10px] px-4 py-3 text-left text-sm ${
              paymentChoice === "pay_now"
                ? "bg-white text-[var(--color-stone-900)]"
                : "bg-white/[0.06]"
            }`}
          >
            Pay now
          </button>
          <input
            type="hidden"
            name="paymentChoice"
            value={paymentChoice ?? ""}
          />

          {paymentChoice === "pay_now" ? (
            <div className="flex flex-col gap-2 rounded-[10px] bg-white/[0.06] p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-stone-400)]">
                Card details — demo
              </p>
              <input
                placeholder="Card number"
                inputMode="numeric"
                autoComplete="off"
                className="rounded-[8px] bg-white/[0.08] px-3 py-2 text-sm placeholder:text-[var(--color-stone-500)]"
              />
              <div className="flex gap-2">
                <input
                  placeholder="MM/YY"
                  autoComplete="off"
                  className="w-1/2 rounded-[8px] bg-white/[0.08] px-3 py-2 text-sm placeholder:text-[var(--color-stone-500)]"
                />
                <input
                  placeholder="CVC"
                  autoComplete="off"
                  className="w-1/2 rounded-[8px] bg-white/[0.08] px-3 py-2 text-sm placeholder:text-[var(--color-stone-500)]"
                />
              </div>
              <p className="text-[11px] text-[var(--color-stone-500)]">
                Demo interface — no card network is connected yet. Your payment
                will show as authorized in this environment only.
              </p>
            </div>
          ) : null}

          {state.formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {state.formError}
            </p>
          ) : null}

          <Button
            type="submit"
            size="sm"
            disabled={isPending || !paymentChoice}
            className="self-start"
          >
            {isPending
              ? "Booking…"
              : paymentChoice === "pay_now"
                ? "Pay & confirm"
                : "Confirm"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
