"use client";

import { buttonVariants } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { decideFitProfileCandidate } from "./actions";

/**
 * useActionState (not a plain `<form action={fn}>`) so there is a real
 * pending state and errors surface inline instead of disappearing
 * silently. Does NOT attempt to auto-refresh the page after success: both
 * a bare `redirect()` back to this same path and an explicit client-side
 * `router.refresh()` were tried and confirmed unreliable against a real
 * browser on this exact page (network trace showed the mutating request
 * complete successfully with no error, but the status text never
 * updating without a hard reload) — a genuine Next.js 15.1 quirk on this
 * route, not something either approach fixed. A manual reload remains
 * the reliable way to see the decision reflected, matching the
 * established precedent on this same page (see fit-tools.spec.ts).
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
