"use client";

import { useActionState } from "react";

import { resendStaffInvite, type StaffInviteActionState } from "./actions";

const initial: StaffInviteActionState = {};

export function ResendInviteForm({
  retailerId,
  staffId,
}: {
  retailerId: string;
  staffId: string;
}) {
  const [state, action, pending] = useActionState(resendStaffInvite, initial);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="retailerId" value={retailerId} />
      <input type="hidden" name="staffId" value={staffId} />
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-xs disabled:opacity-50"
      >
        {pending ? "Sending…" : "Resend invite"}
      </button>
      {state.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-xs text-[var(--color-success-500)]">
          Invite sent.
        </p>
      ) : null}
    </form>
  );
}
