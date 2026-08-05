import type { FitProfileCandidate } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import { decideFitProfileCandidate } from "./actions";

const STATUS_LABELS: Record<FitProfileCandidate["status"], string> = {
  proposed: "Awaiting your review",
  advisor_approved: "Approved — awaiting client confirmation",
  advisor_rejected: "Not proceeding",
  customer_confirmed: "Confirmed",
};

/**
 * FT-01's advisor review step — the distinct reviewed FitProfile candidate/version
 * the blueprint names as not yet built. A fitting_observations row (or batch)
 * is proposed by staff as a candidate fit revision — advisor reviews it
 * against the previous approved fit and either approves (writes new
 * customer_fit_profile_entries) or rejects. This mirrors the
 * silhouette-analysis-card.tsx pattern exactly.
 */
export function FitProfileCandidateCard({
  customerId,
  candidates,
}: {
  customerId: string;
  candidates: readonly FitProfileCandidate[];
}) {
  if (candidates.length === 0) return null;
  const decideAction = decideFitProfileCandidate.bind(null, customerId);

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
      <ul className="flex flex-col gap-3">
        {candidates.map((candidate) => (
          <li
            key={candidate.id}
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--color-stone-900)]">
                {STATUS_LABELS[candidate.status]}
              </p>
              <p className="text-xs text-[var(--color-stone-500)]">
                {formatDate(candidate.createdAt, "en-US")}
              </p>
            </div>
            {candidate.status === "proposed" ? (
              <div className="mt-3 flex gap-2">
                <form action={decideAction}>
                  <input
                    type="hidden"
                    name="candidateId"
                    value={candidate.id}
                  />
                  <input type="hidden" name="decision" value="approved" />
                  <button
                    type="submit"
                    className={buttonVariants({ size: "sm" })}
                  >
                    Approve
                  </button>
                </form>
                <form action={decideAction}>
                  <input
                    type="hidden"
                    name="candidateId"
                    value={candidate.id}
                  />
                  <input type="hidden" name="decision" value="rejected" />
                  <button
                    type="submit"
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
        ))}
      </ul>
    </Card>
  );
}
