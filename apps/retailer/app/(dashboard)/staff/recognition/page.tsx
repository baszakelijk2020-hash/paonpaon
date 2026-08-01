import {
  RetailerStaffRepository,
  StaffRecognitionRepository,
} from "@paon/database";
import {
  retailerRoleAtLeast,
  summarizeRecognitionCoverage,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import {
  ReviewRecognitionForm,
  SubmitRecognitionForm,
} from "./recognition-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STATE_TONE = {
  submitted: "warning",
  acknowledged: "success",
  coached: "neutral",
  dismissed: "neutral",
} as const;

/**
 * Extra-mile recognition (PHASE 11.2 / WFM-104). Open to every retailer
 * role — recognition only managers can see is not recognition, which is
 * also why the table's RLS read policy is deliberately broader than the
 * clienteling surfaces'.
 *
 * There is intentionally no ranking, no per-person total and no "top
 * performer" here. The manager-facing number is COVERAGE: who has received
 * no recognition at all. That is a manager's problem to fix, whereas a
 * leaderboard is an employee's to game — see this item's non-goal.
 */
export default async function RecognitionPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const staffRepo = new RetailerStaffRepository(supabase);
  const recognitionRepo = new StaffRecognitionRepository(supabase);

  const [team, acts, viewer] = await Promise.all([
    staffRepo.findByRetailer(session.retailerId),
    recognitionRepo.listForRetailer({ retailerId: session.retailerId }),
    staffRepo.findByUserId(session.userId),
  ]);

  const isManager = retailerRoleAtLeast(session.retailerRole, "manager");
  // Keyed by plain string: RecognitionAct.staffId is an unbranded string
  // (the recognition domain module has no dependency on branded-id), so a
  // StaffId-keyed map would not accept it as a lookup key.
  const nameByStaffId = new Map<string, string>(
    team.map((m) => [m.id as string, m.fullName]),
  );

  const coverage = summarizeRecognitionCoverage({
    acts,
    allStaffIds: team.map((m) => m.id as string),
  });

  const awaitingReview = acts.filter((a) => a.reviewState === "submitted");
  const reviewed = acts.filter((a) => a.reviewState !== "submitted");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Recognition
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Specific acts worth remembering — not a scoreboard. Nobody is ranked
          here.
        </p>
      </div>

      {isManager ? (
        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Coverage
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone-600)]">
            {coverage.recognizedStaffCount} of {coverage.totalStaffCount} of the
            team have been recognised.
            {coverage.awaitingReviewCount > 0
              ? ` ${coverage.awaitingReviewCount} awaiting your review.`
              : ""}
          </p>
          {coverage.unrecognizedStaffIds.length > 0 ? (
            <p
              id="recognition-coverage-gap"
              className="mt-2 text-sm text-[var(--color-stone-500)]"
            >
              No recognition yet for:{" "}
              {coverage.unrecognizedStaffIds
                .map((id) => nameByStaffId.get(id) ?? "Unknown")
                .join(", ")}
              .
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Log an extra-mile act
        </h2>
        <SubmitRecognitionForm
          team={team.map((m) => ({ id: m.id, fullName: m.fullName }))}
          defaultStaffId={viewer?.id ?? team[0]?.id ?? ""}
        />
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Awaiting review ({awaitingReview.length})
        </h2>
        {awaitingReview.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            Nothing awaiting review.
          </p>
        ) : (
          <ul
            id="recognition-review-queue"
            className="mt-3 flex flex-col gap-4"
          >
            {awaitingReview.map((act) => (
              <li
                key={act.id}
                className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
              >
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {nameByStaffId.get(act.staffId) ?? "Unknown"} ·{" "}
                  {formatDate(act.occurredOn, "en-US")}
                </p>
                <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                  {act.narrative}
                </p>
                <p className="mt-1 text-xs text-[var(--color-stone-400)]">
                  Logged by{" "}
                  {nameByStaffId.get(act.authoredByStaffId) ?? "Unknown"}
                </p>
                {isManager ? <ReviewRecognitionForm actId={act.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Recognised ({reviewed.length})
        </h2>
        {reviewed.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            Nothing recognised yet.
          </p>
        ) : (
          <ul id="recognition-reviewed" className="mt-3 flex flex-col gap-4">
            {reviewed.map((act) => (
              <li
                key={act.id}
                className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {nameByStaffId.get(act.staffId) ?? "Unknown"}
                  </p>
                  <Badge tone={STATE_TONE[act.reviewState]}>
                    {act.reviewState}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                  {act.narrative}
                </p>
                {act.coachingNote ? (
                  <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                    Coaching: {act.coachingNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
