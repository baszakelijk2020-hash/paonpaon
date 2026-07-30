import type { ClientelingOpportunity } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import {
  assignOpportunityToMe,
  dismissOpportunity,
  recordOpportunityOutcome,
} from "./opportunity-actions";

const HOOK_LABELS: Record<ClientelingOpportunity["hookKind"], string> = {
  recent_browsing: "Recent browsing",
  interest_affinity: "Interest pattern",
  advisor_question: "Advisor question",
  appointment_intent: "Appointment intent",
  wishlist_signal: "Saved product",
  dormancy: "Re-engage",
};

const ACTION_LABELS: Record<ClientelingOpportunity["suggestedAction"], string> =
  {
    send_message: "Send message",
    book_appointment: "Book appointment",
    add_note: "Add note",
    review_shortlist: "Review shortlist",
  };

const CHANNEL_LABELS: Record<
  ClientelingOpportunity["suggestedChannel"],
  string
> = {
  in_app_message: "In-app message",
  phone: "Phone",
  in_store: "In store",
  email: "Email",
};

export function OpportunityInbox({
  opportunities,
  canAct,
}: {
  opportunities: readonly ClientelingOpportunity[];
  canAct: boolean;
}) {
  if (opportunities.length === 0) {
    return (
      <Card className="border-dashed py-8 text-center">
        <p className="font-display text-2xl">No open opportunities</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-stone-500)]">
          Draft hooks appear when consented clients browse, ask questions, or
          show intent. Nothing is sent automatically.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {opportunities.map((opportunity) => (
        <Card
          key={opportunity.id}
          className="border-l-4 border-l-[var(--color-stone-900)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone="neutral">
                  {HOOK_LABELS[opportunity.hookKind]}
                </Badge>
                <span className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                  {opportunity.status}
                </span>
              </div>
              <p className="font-medium text-[var(--color-stone-900)]">
                {opportunity.title}
              </p>
              <p className="mt-1 text-sm text-[var(--color-stone-600)]">
                {opportunity.whyNow}
              </p>
              <p className="mt-2 text-xs text-[var(--color-stone-500)]">
                Suggested: {ACTION_LABELS[opportunity.suggestedAction]} via{" "}
                {CHANNEL_LABELS[opportunity.suggestedChannel]} · priority{" "}
                {opportunity.priority} · confidence{" "}
                {opportunity.confidence.toFixed(2)} · due{" "}
                {formatDate(opportunity.dueAt, "en-US")} ·{" "}
                {opportunity.evidence.length} evidence refs
              </p>
            </div>
            <Link
              href={`/customers/${opportunity.customerId}`}
              className="shrink-0 text-sm font-medium underline underline-offset-4"
            >
              Open client
            </Link>
          </div>

          {canAct ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-stone-100)] pt-4">
              <form action={assignOpportunityToMe}>
                <input
                  type="hidden"
                  name="opportunityId"
                  value={opportunity.id}
                />
                <Button type="submit" variant="outline" size="sm">
                  Assign to me
                </Button>
              </form>
              <form action={recordOpportunityOutcome}>
                <input
                  type="hidden"
                  name="opportunityId"
                  value={opportunity.id}
                />
                <input type="hidden" name="outcomeType" value="message_sent" />
                <Button type="submit" variant="secondary" size="sm">
                  Mark message sent
                </Button>
              </form>
              <form action={recordOpportunityOutcome}>
                <input
                  type="hidden"
                  name="opportunityId"
                  value={opportunity.id}
                />
                <input
                  type="hidden"
                  name="outcomeType"
                  value="appointment_booked"
                />
                <Button type="submit" variant="secondary" size="sm">
                  Mark appointment booked
                </Button>
              </form>
              <form action={dismissOpportunity}>
                <input
                  type="hidden"
                  name="opportunityId"
                  value={opportunity.id}
                />
                <Button type="submit" variant="ghost" size="sm">
                  Dismiss
                </Button>
              </form>
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
