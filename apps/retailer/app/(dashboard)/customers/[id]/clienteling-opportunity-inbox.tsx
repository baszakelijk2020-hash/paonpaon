import type { ClientelingOpportunity } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";

import { setClientelingOpportunityStatus } from "./opportunity-actions";

const TYPE_LABELS: Record<ClientelingOpportunity["type"], string> = {
  interest_follow_up: "Interest follow-up",
  purchase_care_check: "Purchase care check",
  occasion_readiness: "Occasion readiness",
  relationship_dormancy: "Relationship dormancy",
  wardrobe_gap: "Wardrobe gap",
  anniversary_moment: "Anniversary moment",
  contact_pressure_warning: "Contact pressure",
};

/**
 * Sparse draft opportunity inbox for one customer — human review before
 * any outbound touch (CLI-005 / PHASE 7.4).
 */
export function ClientelingOpportunityInbox({
  customerId,
  opportunities,
}: {
  readonly customerId: string;
  readonly opportunities: readonly ClientelingOpportunity[];
}) {
  const drafts = opportunities.filter((row) => row.status === "draft");
  const recent = opportunities
    .filter((row) => row.status !== "draft")
    .slice(0, 5);

  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Clienteling opportunities
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Draft hooks only — review before contacting. Contact-pressure warnings
          replace a follow-up firehose.
        </p>
      </div>

      {drafts.length === 0 ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          No draft opportunities yet. Cited interest insights will appear here
          when behaviour and accepted metadata support them.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {drafts.map((opportunity) => (
            <li
              key={opportunity.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge
                  tone={opportunity.contactPressure ? "warning" : "neutral"}
                >
                  {TYPE_LABELS[opportunity.type]}
                </Badge>
                <span className="text-xs text-[var(--color-stone-500)]">
                  Priority {opportunity.priority} ·{" "}
                  {Math.round(opportunity.confidence * 100)}% confidence ·{" "}
                  {opportunity.channel.replaceAll("_", " ")}
                </span>
              </div>
              <p className="text-sm font-medium text-[var(--color-stone-900)]">
                Why now: {opportunity.whyNow}
              </p>
              <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                Suggested: {opportunity.suggestedAction}
              </p>
              {opportunity.bestTimeWindow ? (
                <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                  Best window: {opportunity.bestTimeWindow}
                </p>
              ) : null}
              {opportunity.evidence.length > 0 ? (
                <p className="mt-2 text-xs text-[var(--color-stone-500)]">
                  Evidence:{" "}
                  {opportunity.evidence
                    .map((item) => item.insightStatement ?? item.note)
                    .filter(Boolean)
                    .join("; ")}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["accepted", "Accept"],
                    ["snoozed", "Snooze"],
                    ["dismissed", "Dismiss"],
                    ["incorrect", "Incorrect"],
                  ] as const
                ).map(([status, label]) => (
                  <form key={status} action={setClientelingOpportunityStatus}>
                    <input
                      type="hidden"
                      name="opportunityId"
                      value={opportunity.id}
                    />
                    <input type="hidden" name="customerId" value={customerId} />
                    <input type="hidden" name="status" value={status} />
                    <button
                      type="submit"
                      className="rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 py-1.5 text-xs text-[var(--color-stone-800)] hover:bg-[var(--color-stone-50)]"
                    >
                      {label}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 ? (
        <div className="mt-6 border-t border-[var(--color-stone-200)] pt-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--color-stone-800)]">
            Recent decisions
          </h3>
          <ul className="flex flex-col gap-2 text-sm text-[var(--color-stone-600)]">
            {recent.map((opportunity) => (
              <li key={opportunity.id}>
                <span className="capitalize">{opportunity.status}</span>
                {" — "}
                {opportunity.whyNow}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
