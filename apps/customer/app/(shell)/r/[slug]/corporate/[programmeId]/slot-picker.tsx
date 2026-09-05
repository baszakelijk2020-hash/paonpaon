"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { formatDate } from "@paon/utils";
import { useActionState, useState } from "react";

import { claimVisitSlot, type ClaimVisitSlotFormState } from "./actions";

export interface OpenVisitSlotView {
  readonly id: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly remainingCapacity: number;
}

const INITIAL_STATE: ClaimVisitSlotFormState = {
  fieldErrors: {},
  claimed: false,
};

/** Self-service booking (PHASE 18.4, direct founder instruction
 * 2026-08-19) — a visitor picks one of the retailer's real open slots and
 * claims it directly, no staff step. If the claim is refused (another
 * visitor just took it — the DB-level lock in claim_corporate_visit_slot
 * is the real prevention, this is only ever surfacing its decision), the
 * form stays open with the error shown so the visitor can pick a
 * different slot without losing what they typed. */
export function VisitSlotPicker({
  slots,
}: {
  slots: readonly OpenVisitSlotView[];
}) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [claimState, claimAction, isPending] = useActionState(
    claimVisitSlot.bind(null, selectedSlotId ?? ""),
    INITIAL_STATE,
  );

  if (claimState.claimed) {
    return (
      <p role="status" className="text-sm text-[var(--color-stone-700)]">
        Booked — we look forward to your visit.
      </p>
    );
  }

  if (!selectedSlotId) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-[var(--color-stone-500)]">
          Choose a time for your visit.
        </p>
        <ul className="flex flex-col gap-2">
          {slots.map((slot) => (
            <li key={slot.id}>
              <button
                type="button"
                onClick={() => setSelectedSlotId(slot.id)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-left text-sm hover:border-[var(--color-stone-400)]"
              >
                <span className="font-medium text-[var(--color-stone-900)]">
                  {formatDate(slot.startsAt, "en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  } as Intl.DateTimeFormatOptions)}
                </span>
                <span className="ml-2 text-[var(--color-stone-500)]">
                  {slot.remainingCapacity}{" "}
                  {slot.remainingCapacity === 1 ? "spot" : "spots"} left
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form action={claimAction} className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setSelectedSlotId(null)}
        className="self-start text-xs text-[var(--color-stone-500)] underline"
      >
        Choose a different time
      </button>
      <FormField
        label="Your name"
        htmlFor="requesterName"
        error={claimState.fieldErrors["requesterName"]}
      >
        <Input
          id="requesterName"
          name="requesterName"
          required
          invalid={!!claimState.fieldErrors["requesterName"]}
        />
      </FormField>
      <FormField
        label="Employee reference (optional)"
        htmlFor="employeeReference"
      >
        <Input id="employeeReference" name="employeeReference" />
      </FormField>
      <FormField label="Contact email (optional)" htmlFor="contactEmail">
        <Input id="contactEmail" name="contactEmail" type="email" />
      </FormField>
      <FormField label="Note (optional)" htmlFor="note">
        <textarea
          id="note"
          name="note"
          maxLength={2000}
          className="min-h-20 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-sm"
        />
      </FormField>
      {claimState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {claimState.formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Booking…" : "Confirm booking"}
      </Button>
    </form>
  );
}
