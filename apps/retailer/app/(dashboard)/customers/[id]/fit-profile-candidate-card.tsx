import type { FitProfileCandidate } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import { FitProfileCandidateDecision } from "./fit-profile-candidate-decision";

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
 * against the previous approved fit and either approves (advancing the
 * candidate's own status; the contributing fitting_observations rows
 * already are the durable record under the garment-first model) or
 * rejects. This mirrors the silhouette-analysis-card.tsx pattern exactly.
 */
export function FitProfileCandidateCard({
  customerId,
  candidates,
}: {
  customerId: string;
  candidates: readonly FitProfileCandidate[];
}) {
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
            {Object.keys(candidate.proposedMeasurements).length > 0 ? (
              <div className="mt-2 border-t border-[var(--color-stone-100)] pt-2">
                <p className="mb-2 text-xs font-medium text-[var(--color-stone-600)]">
                  Proposed measurements:
                </p>
                <ul className="space-y-1">
                  {Object.entries(candidate.proposedMeasurements).map(
                    ([key, value]) => (
                      <li
                        key={key}
                        className="text-sm text-[var(--color-stone-700)]"
                      >
                        {key}:{" "}
                        <span className="font-medium">{String(value)}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}
            {candidate.status === "proposed" ? (
              <FitProfileCandidateDecision
                customerId={customerId}
                candidateId={candidate.id}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
