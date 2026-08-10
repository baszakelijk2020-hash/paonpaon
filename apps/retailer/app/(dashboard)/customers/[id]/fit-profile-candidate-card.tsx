"use client";

import type { FitProfileCandidate } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import { useActionState } from "react";

import {
  decideFitProfileCandidate,
  type DecideFitProfileCandidateState,
} from "./actions";

const STATUS_LABELS: Record<FitProfileCandidate["status"], string> = {
  proposed: "Awaiting your review",
  advisor_approved: "Approved — awaiting client confirmation",
  advisor_rejected: "Not proceeding",
  customer_confirmed: "Confirmed",
};

const DECISION_STATUS: Record<
  "approved" | "rejected",
  FitProfileCandidate["status"]
> = {
  approved: "advisor_approved",
  rejected: "advisor_rejected",
};

const initialState: DecideFitProfileCandidateState = {};

/**
 * FT-01's advisor review step — the distinct reviewed FitProfile candidate/version
 * the blueprint names as not yet built. A fitting_observations row (or batch)
 * is proposed by staff as a candidate fit revision — advisor reviews it
 * against the previous approved fit and either approves or rejects.
 * Approving advances the candidate's own status; it does not write a
 * customer-level measurement row (see decideFitProfileCandidate's own
 * doc comment for why). The action's own returned `decided` value drives
 * this one card's displayed status directly, rather than depending on a
 * full page/router refresh to reflect the mutation.
 */
export function FitProfileCandidateCard({
  customerId,
  candidates,
}: {
  customerId: string;
  candidates: readonly FitProfileCandidate[];
}) {
  const [state, formAction, isPending] = useActionState(
    decideFitProfileCandidate.bind(null, customerId),
    initialState,
  );

  if (candidates.length === 0) return null;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Fit profile candidates
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Proposed measurement revisions awaiting your review.
        </p>
      </div>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {candidates.map((candidate) => {
          const decidedHere =
            state.decided?.candidateId === candidate.id
              ? state.decided.decision
              : undefined;
          const effectiveStatus = decidedHere
            ? DECISION_STATUS[decidedHere]
            : candidate.status;
          return (
            <li
              key={candidate.id}
              data-candidate-id={candidate.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {STATUS_LABELS[effectiveStatus]}
                </p>
                <p className="text-xs text-[var(--color-stone-500)]">
                  {formatDate(candidate.createdAt, "en-US")}
                </p>
              </div>
              {effectiveStatus === "proposed" ? (
                <div className="mt-3 flex gap-2">
                  <form action={formAction}>
                    <input
                      type="hidden"
                      name="candidateId"
                      value={candidate.id}
                    />
                    <input type="hidden" name="decision" value="approved" />
                    <button
                      type="submit"
                      disabled={isPending}
                      className={buttonVariants({ size: "sm" })}
                    >
                      Approve
                    </button>
                  </form>
                  <form action={formAction}>
                    <input
                      type="hidden"
                      name="candidateId"
                      value={candidate.id}
                    />
                    <input type="hidden" name="decision" value="rejected" />
                    <button
                      type="submit"
                      disabled={isPending}
                      className={buttonVariants({
                        size: "sm",
                        variant: "outline",
                      })}
                    >
                      Not this one
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
