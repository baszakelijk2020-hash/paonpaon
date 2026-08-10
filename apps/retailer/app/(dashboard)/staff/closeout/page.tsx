import {
  RetailerStaffRepository,
  ShiftCloseoutRepository,
  StaffRecognitionRepository,
} from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import { SubmitCloseoutForm } from "./closeout-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Shift closeout (PHASE 11.2 / WFM-104). This is the ten-minute closeout
 * flow where staff members capture promises, facts learned, problems,
 * anomalies, what worked, and help needed. Managers can see the team's
 * closeouts for today.
 */
export default async function CloseoutPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const staffRepo = new RetailerStaffRepository(supabase);
  const closeoutRepo = new ShiftCloseoutRepository(supabase);
  const recognitionRepo = new StaffRecognitionRepository(supabase);

  const [viewer, team, closeouts, todayRecognitionActs] = await Promise.all([
    staffRepo.findByUserId(session.userId),
    staffRepo.findByRetailer(session.retailerId),
    closeoutRepo.listForRetailerAndDate({
      retailerId: session.retailerId,
      closeoutDate: new Date().toISOString().slice(0, 10),
    }),
    recognitionRepo.listForRetailer({
      retailerId: session.retailerId,
      limit: 100,
    }),
  ]);

  if (!viewer) {
    throw new Error("Viewer staff record not found");
  }

  // Filter recognition acts to only those created by the viewer today
  const today = new Date().toISOString().slice(0, 10);
  const viewerTodayActs = todayRecognitionActs.filter(
    (act) =>
      act.authoredByStaffId === viewer.id &&
      act.occurredOn === today &&
      act.reviewState !== "dismissed",
  );

  // Find today's closeout for the viewer (if it exists)
  const viewerTodayCloseout = closeouts.find((c) => c.staffId === viewer.id);

  const isManager = retailerRoleAtLeast(session.retailerRole, "manager");

  // Map staff names for display
  const nameByStaffId = new Map<string, string>(
    team.map((m) => [m.id as string, m.fullName]),
  );

  // Compute opportunities count for this staff member
  // (In this MVP, we show the count but not a full opportunities query —
  // that would require loading the clienteling_opportunities table)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Shift Closeout
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Ten-minute reflection on promises, learnings, and what worked today.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Close out your shift
        </h2>
        {viewerTodayCloseout ? (
          <SubmitCloseoutForm
            closeoutDate={today}
            todayActsForStaff={viewerTodayActs}
            initialCloseout={{
              promisesNote: viewerTodayCloseout.promisesNote,
              whatWorkedNote: viewerTodayCloseout.whatWorkedNote,
              ...(viewerTodayCloseout.factsLearnedNote
                ? { factsLearnedNote: viewerTodayCloseout.factsLearnedNote }
                : {}),
              ...(viewerTodayCloseout.problemsNote
                ? { problemsNote: viewerTodayCloseout.problemsNote }
                : {}),
              ...(viewerTodayCloseout.anomaliesNote
                ? { anomaliesNote: viewerTodayCloseout.anomaliesNote }
                : {}),
              ...(viewerTodayCloseout.helpRequestedNote
                ? {
                    helpRequestedNote: viewerTodayCloseout.helpRequestedNote,
                  }
                : {}),
              ...(viewerTodayCloseout.extraMileActId
                ? { extraMileActId: viewerTodayCloseout.extraMileActId }
                : {}),
            }}
          />
        ) : (
          <SubmitCloseoutForm
            closeoutDate={today}
            todayActsForStaff={viewerTodayActs}
          />
        )}
      </Card>

      {isManager && closeouts.length > 0 ? (
        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Team closeouts for today ({closeouts.length})
          </h2>
          <ul id="team-closeouts" className="mt-3 flex flex-col gap-4">
            {closeouts.map((closeout) => (
              <li
                key={closeout.id}
                className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
              >
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {nameByStaffId.get(closeout.staffId) ?? "Unknown"}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {formatDate(closeout.submittedAt, "en-US")}
                  </p>
                </div>

                <div className="mt-2 space-y-1 text-sm">
                  <div>
                    <p className="font-medium text-[var(--color-stone-600)]">
                      Promises:
                    </p>
                    <p className="text-[var(--color-stone-700)]">
                      {closeout.promisesNote}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--color-stone-600)]">
                      What worked:
                    </p>
                    <p className="text-[var(--color-stone-700)]">
                      {closeout.whatWorkedNote}
                    </p>
                  </div>

                  {closeout.factsLearnedNote ? (
                    <div>
                      <p className="font-medium text-[var(--color-stone-600)]">
                        Facts learned:
                      </p>
                      <p className="text-[var(--color-stone-700)]">
                        {closeout.factsLearnedNote}
                      </p>
                    </div>
                  ) : null}

                  {closeout.problemsNote ? (
                    <div>
                      <p className="font-medium text-[var(--color-stone-600)]">
                        Problems:
                      </p>
                      <p className="text-[var(--color-stone-700)]">
                        {closeout.problemsNote}
                      </p>
                    </div>
                  ) : null}

                  {closeout.anomaliesNote ? (
                    <div>
                      <p className="font-medium text-[var(--color-stone-600)]">
                        Anomalies:
                      </p>
                      <p className="text-[var(--color-stone-700)]">
                        {closeout.anomaliesNote}
                      </p>
                    </div>
                  ) : null}

                  {closeout.helpRequestedNote ? (
                    <div>
                      <p className="font-medium text-[var(--color-stone-600)]">
                        Help requested:
                      </p>
                      <p className="text-[var(--color-stone-700)]">
                        {closeout.helpRequestedNote}
                      </p>
                    </div>
                  ) : null}

                  {closeout.extraMileActId ? (
                    <div>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        Linked to extra-mile act
                      </p>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : isManager ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            No team closeouts yet for today.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
