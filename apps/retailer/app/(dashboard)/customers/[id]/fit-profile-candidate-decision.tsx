"use client";

import { buttonVariants } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { decideFitProfileCandidate } from "./actions";

/**
 * useActionState (not a plain `<form action={fn}>`) so the client router
 * refresh is driven from the action's own resolved state rather than
 * relying on a bare revalidatePath to reach the page before the test/user
 * next looks — see decideFitProfileCandidate's own comment.
 */
export function FitProfileCandidateDecision({
  customerId,
  candidateId,
}: {
  customerId: string;
  candidateId: string;
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    decideFitProfileCandidate.bind(null, customerId),
    {},
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    decideFitProfileCandidate.bind(null, customerId),
    {},
  );

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <form action={approveAction}>
          <input type="hidden" name="candidateId" value={candidateId} />
          <input type="hidden" name="decision" value="approved" />
          <button
            type="submit"
            disabled={approvePending || rejectPending}
            className={buttonVariants({ size: "sm" })}
          >
            {approvePending ? "Approving…" : "Approve"}
          </button>
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="candidateId" value={candidateId} />
          <input type="hidden" name="decision" value="rejected" />
          <button
            type="submit"
            disabled={approvePending || rejectPending}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            {rejectPending ? "Deciding…" : "Not this one"}
          </button>
        </form>
      </div>
      {approveState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {approveState.formError}
        </p>
      ) : null}
      {rejectState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {rejectState.formError}
        </p>
      ) : null}
    </div>
  );
}
