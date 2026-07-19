"use client";

import type { RetailerStaffMember } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  createAvailabilityWindow,
  type CreateAvailabilityWindowFormState,
} from "./actions";

// Defined here, not in actions.ts — a "use server" file may only
// export async functions; a plain data constant consumed from a
// Client Component (this one, via useActionState's initial state)
// trips Next's "found object" check on that module boundary.
const initialCreateAvailabilityWindowFormState: CreateAvailabilityWindowFormState =
  {
    values: {},
    fieldErrors: {},
  };

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function AvailabilityForm({
  staffOptions,
  defaultStaffId,
}: {
  staffOptions: readonly RetailerStaffMember[] | null;
  defaultStaffId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createAvailabilityWindow,
    initialCreateAvailabilityWindowFormState,
  );
  const v = state.values;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {staffOptions ? (
        <FormField
          label="Staff member"
          htmlFor="staffId"
          error={state.fieldErrors["staffId"]}
        >
          <Select
            id="staffId"
            name="staffId"
            defaultValue={v["staffId"] ?? defaultStaffId}
          >
            {staffOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </Select>
        </FormField>
      ) : (
        <input type="hidden" name="staffId" value={defaultStaffId} />
      )}
      <FormField
        label="Day"
        htmlFor="dayOfWeek"
        error={state.fieldErrors["dayOfWeek"]}
      >
        <Select
          id="dayOfWeek"
          name="dayOfWeek"
          defaultValue={v["dayOfWeek"] ?? "1"}
        >
          {DAY_LABELS.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label="Start"
        htmlFor="startTime"
        error={state.fieldErrors["startTime"]}
      >
        <Input
          id="startTime"
          name="startTime"
          type="time"
          defaultValue={v["startTime"] ?? "09:00"}
          required
        />
      </FormField>
      <FormField
        label="End"
        htmlFor="endTime"
        error={state.fieldErrors["endTime"]}
      >
        <Input
          id="endTime"
          name="endTime"
          type="time"
          defaultValue={v["endTime"] ?? "17:00"}
          required
        />
      </FormField>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add window"}
      </Button>
      {state.formError ? (
        <p
          role="alert"
          className="w-full text-sm text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
