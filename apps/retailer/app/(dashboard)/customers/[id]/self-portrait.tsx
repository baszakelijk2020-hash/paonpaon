import type {
  BehavioralEvent,
  ClientelingNote,
  CustomerInterestProjection,
  LoyaltyAccount,
  LoyaltyMilestoneAward,
} from "@paon/domain";
import { LOYALTY_TIER_LABELS, milestonePresentation } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

const TIER_TONE = {
  member: "neutral",
  silver: "neutral",
  gold: "warning",
  platinum: "success",
} as const;

const EVENT_LABELS: Record<string, string> = {
  product_viewed: "Viewed a product",
  product_favorited: "Favorited a product",
  product_skipped: "Skipped a product",
  category_browsed: "Browsed a category",
  search_performed: "Searched the catalogue",
  filter_applied: "Applied a filter",
  cart_updated: "Updated the cart",
  knowledge_opened: "Opened a knowledge card",
  advisor_question: "Asked an advisor question",
  appointment_intent: "Showed appointment intent",
  conversion_recorded: "Recorded a conversion signal",
};

function eventLabel(event: BehavioralEvent): string {
  return EVENT_LABELS[event.name] ?? event.name.replaceAll("_", " ");
}

const CLIENTELING_PROMPT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function isRecent(occurredAt: string | undefined): boolean {
  if (!occurredAt) return false;
  return (
    Date.now() - new Date(occurredAt).getTime() < CLIENTELING_PROMPT_WINDOW_MS
  );
}

function interestWindowLabel(projection: CustomerInterestProjection): string {
  const start = formatDate(projection.windowStart, "en-US");
  const end = formatDate(projection.windowEnd, "en-US");
  return `${start} – ${end}`;
}

/**
 * The one place staff read the customer as a whole rather than
 * per-record — loyalty standing, what they've been doing, and what the
 * team already knows about them. Everything here is composed from
 * data already captured elsewhere (loyalty accrual, behavioral
 * tracking, clienteling notes); this card adds no new domain state.
 */
export function SelfPortrait({
  loyaltyAccount,
  milestoneAwards,
  recentEvents,
  pinnedNote,
  interestProjection,
}: {
  loyaltyAccount: LoyaltyAccount | null;
  milestoneAwards: LoyaltyMilestoneAward[];
  recentEvents: BehavioralEvent[];
  pinnedNote: ClientelingNote | null;
  interestProjection: CustomerInterestProjection;
}) {
  const activeMilestones = milestoneAwards.filter(
    (award) => award.status === "awarded",
  );
  const usableInterests =
    interestProjection.visibility === "usable"
      ? interestProjection.insights
      : [];

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Self-Portrait
          </h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            What the team knows about this customer, in one place.
          </p>
        </div>
        {loyaltyAccount ? (
          <div className="text-right">
            <Badge tone={TIER_TONE[loyaltyAccount.tier]}>
              {LOYALTY_TIER_LABELS[loyaltyAccount.tier]}
            </Badge>
            <p className="mt-1 text-sm text-[var(--color-stone-700)]">
              {loyaltyAccount.pointsBalance.toLocaleString("en-US")} pts
            </p>
            <Link
              href="/loyalty"
              className="mt-1 inline-block text-xs underline underline-offset-4"
            >
              Programme rules
            </Link>
          </div>
        ) : null}
      </div>

      {pinnedNote ? (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-[var(--color-stone-50)] p-3">
          <p className="text-sm text-[var(--color-stone-900)]">
            {pinnedNote.body}
          </p>
        </div>
      ) : null}

      {activeMilestones.length ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Tailoring milestones
          </p>
          <ul className="flex flex-col gap-1.5">
            {activeMilestones.slice(0, 5).map((award) => {
              const presentation = milestonePresentation({
                kind: award.kind,
                label: award.label,
                points: award.points,
                status: award.status,
              });
              return (
                <li
                  key={award.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-[var(--color-stone-800)]">
                    {presentation.headline}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--color-stone-500)]">
                    {award.points} pts
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {isRecent(recentEvents[0]?.occurredAt) ? (
        <div className="border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/10 mb-4 flex items-center justify-between rounded-[var(--radius-md)] border px-3 py-2">
          <p className="text-sm text-[var(--color-stone-800)]">
            Active in the last few days — worth a note for the book?
          </p>
          <a
            href="#clienteling-notes"
            className="whitespace-nowrap text-sm font-medium underline underline-offset-4"
          >
            Add note
          </a>
        </div>
      ) : null}

      <div className="mb-4">
        <p className="mb-1 text-xs font-medium uppercase text-[var(--color-stone-500)]">
          Recent interests
        </p>
        <p className="mb-2 text-xs text-[var(--color-stone-500)]">
          Why we think this · {interestWindowLabel(interestProjection)}
          {interestProjection.visibility === "usable"
            ? " · session counts unavailable until session instrumentation"
            : null}
        </p>
        {usableInterests.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            {interestProjection.emptyStateCopy}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {usableInterests.map((insight) => (
              <li
                key={`${insight.scopeConceptId}-${insight.attributeConceptId}-${insight.polarity}`}
                className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-[var(--color-stone-50)] px-3 py-2"
              >
                <p className="text-sm text-[var(--color-stone-900)]">
                  {insight.statement}
                </p>
                <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                  {insight.numerator}/{insight.denominator} unique products ·{" "}
                  {Math.round(insight.share * 100)}% · {insight.eventCount}{" "}
                  events · confidence {insight.confidence.toFixed(2)} · latest{" "}
                  {formatDate(insight.latestEvidenceAt, "en-US")} ·{" "}
                  {insight.evidenceEventIds.length} evidence refs
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-[var(--color-stone-500)]">
          Recent activity
        </p>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No tracked activity yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {recentEvents.slice(0, 6).map((event, index) => (
              <li
                key={`${event.name}-${event.occurredAt}-${index}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-[var(--color-stone-800)]">
                  {eventLabel(event)}
                </span>
                <span className="text-xs text-[var(--color-stone-500)]">
                  {formatDate(event.occurredAt, "en-US")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
