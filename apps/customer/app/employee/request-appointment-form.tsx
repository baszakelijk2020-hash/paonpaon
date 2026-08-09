"use client";

import { APPOINTMENT_TYPES, APPOINTMENT_TYPE_LABELS } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { DateTimePicker } from "@paon/ui/components/DateTimePicker";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import {
  requestAppointmentAsWearer,
  type RequestAppointmentFormState,
} from "./actions";

const initialState: RequestAppointmentFormState = { submitted: false };

/** PHASE 18.5 / BD-105 write-capable self-service — only rendered when
 * the wearer already has a linked customer (see `page.tsx`); the RPC
 * itself refuses an unlinked wearer with a clear reason regardless. */
export function RequestAppointmentForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    requestAppointmentAsWearer,
    initialState,
  );

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && !state.formError) {
      router.refresh();
    }
    wasPending.current = isPending;
  }, [isPending, state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormField label="What would you like to book?" htmlFor="type">
        <Select id="type" name="type" defaultValue={APPOINTMENT_TYPES[0]}>
          {APPOINTMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {APPOINTMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Preferred date & time" htmlFor="startsAt" labelledGroup>
        <DateTimePicker name="startsAt" label="Preferred date & time" />
      </FormField>
      <FormField label="Anything we should know?" htmlFor="notes">
        <Input id="notes" name="notes" />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.submitted ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Appointment requested.
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Requesting…" : "Request appointment"}
      </Button>
    </form>
  );
}
