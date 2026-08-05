"use client";

import { buttonVariants } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { decideSilhouetteAnalysisCandidate } from "./actions";

/** Mirrors fit-profile-candidate-decision.tsx exactly — see its own comment. */
export function SilhouetteAnalysisDecision({
  customerId,
  sessionId,
}: {
  customerId: string;
  sessionId: string;
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    decideSilhouetteAnalysisCandidate.bind(null, customerId),
    {},
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    decideSilhouetteAnalysisCandidate.bind(null, customerId),
    {},
  );

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <form action={approveAction}>
          <input type="hidden" name="sessionId" value={sessionId} />
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
          <input type="hidden" name="sessionId" value={sessionId} />
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
