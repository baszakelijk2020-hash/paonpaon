"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import { updatePartySchedule, type UpdatePartyScheduleState } from "../actions";

const initial: UpdatePartyScheduleState = {};

export function PartyScheduleForm({
  partyId,
  eventDate,
  eventTime,
  venueName,
  fittingLocation,
  notes,
}: {
  partyId: string;
  eventDate?: string;
  eventTime?: string;
  venueName?: string;
  fittingLocation?: string;
  notes?: string;
}) {
  const [state, action, pending] = useActionState(
    updatePartySchedule.bind(null, partyId),
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Event date" htmlFor="eventDate">
          <Input
            id="eventDate"
            name="eventDate"
            type="date"
            defaultValue={eventDate ?? ""}
          />
        </FormField>
        <FormField label="Fitting time" htmlFor="eventTime">
          <Input
            id="eventTime"
            name="eventTime"
            type="time"
            defaultValue={eventTime ?? ""}
          />
        </FormField>
      </div>
      <FormField
        label="Wedding venue"
        htmlFor="venueName"
        hint="Ceremony venue, not the shop"
      >
        <Input
          id="venueName"
          name="venueName"
          defaultValue={venueName ?? ""}
          placeholder="Wedding venue"
        />
      </FormField>
      <FormField
        label="Fitting location"
        htmlFor="fittingLocation"
        hint="Which shop the party meets at"
      >
        <Input
          id="fittingLocation"
          name="fittingLocation"
          defaultValue={fittingLocation ?? ""}
          placeholder="Atelier address or store name"
        />
      </FormField>
      <FormField label="Notes" htmlFor="notes">
        <Input id="notes" name="notes" defaultValue={notes ?? ""} />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-[var(--color-stone-600)]">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save schedule"}
      </Button>
    </form>
  );
}
