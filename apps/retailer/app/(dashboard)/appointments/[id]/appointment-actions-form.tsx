"use client";

import { APPOINTMENT_STATUSES, type RetailerStaffMember } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  initialUpdateAppointmentFormState,
  updateAppointment,
} from "./actions";

export function AppointmentActionsForm({
  appointmentId,
  currentStatus,
  currentStaffId,
  staff,
}: {
  appointmentId: string;
  currentStatus: string;
  currentStaffId?: string;
  staff: readonly RetailerStaffMember[];
}) {
  const boundAction = updateAppointment.bind(null, appointmentId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialUpdateAppointmentFormState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label
          htmlFor="status"
          className="mb-1 block text-sm font-medium text-[var(--color-stone-700)]"
        >
          Status
        </label>
        <Select id="status" name="status" defaultValue={currentStatus}>
          {APPOINTMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label
          htmlFor="staffId"
          className="mb-1 block text-sm font-medium text-[var(--color-stone-700)]"
        >
          Advisor
        </label>
        <Select id="staffId" name="staffId" defaultValue={currentStaffId ?? ""}>
          <option value="">Unassigned</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
