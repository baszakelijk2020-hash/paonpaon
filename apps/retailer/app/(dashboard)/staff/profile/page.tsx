import {
  RetailerStaffRepository,
  ShiftCloseoutRepository,
  StaffRecognitionRepository,
  WorkshopRepository,
} from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const RECOGNITION_TONE = {
  submitted: "warning",
  acknowledged: "success",
  coached: "neutral",
  dismissed: "neutral",
} as const;

/**
 * A staff member's own record of work. This deliberately reads only the
 * viewer's closeouts and recognition acts: it is evidence, not performance
 * comparison or a second appointment workspace.
 */
export default async function StaffProfilePage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const staffRepo = new RetailerStaffRepository(supabase);
  const closeoutRepo = new ShiftCloseoutRepository(supabase);
  const recognitionRepo = new StaffRecognitionRepository(supabase);
  const workshopRepo = new WorkshopRepository(supabase);

  const viewer = await staffRepo.findByUserId(session.userId);
  if (!viewer) {
    throw new Error("Viewer staff record not found");
  }

  const [closeouts, recognitionActs, team, workshop] = await Promise.all([
    closeoutRepo.listForStaff({
      retailerId: session.retailerId,
      staffId: viewer.id,
      limit: 10,
    }),
    recognitionRepo.listForStaff({
      retailerId: session.retailerId,
      staffId: viewer.id,
      limit: 10,
    }),
    staffRepo.findByRetailer(session.retailerId),
    viewer.workshopId ? workshopRepo.findById(viewer.workshopId) : null,
  ]);

  const nameByStaffId = new Map<string, string>(
    team.map((staff) => [staff.id as string, staff.fullName]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          My Profile
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Your role and the work evidence recorded for you.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Identity
        </h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-[var(--color-stone-500)]">
              Name
            </dt>
            <dd className="mt-1 text-[var(--color-stone-900)]">
              {viewer.fullName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[var(--color-stone-500)]">
              Role
            </dt>
            <dd className="mt-1 capitalize text-[var(--color-stone-900)]">
              {viewer.role.replaceAll("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[var(--color-stone-500)]">
              Workshop
            </dt>
            <dd className="mt-1 text-[var(--color-stone-900)]">
              {workshop?.name ?? "No workshop assignment"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Recent closeouts
        </h2>
        {closeouts.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No closeouts recorded yet.
          </p>
        ) : (
          <ul
            className="mt-4 flex flex-col gap-4"
            aria-label="Recent closeouts"
          >
            {closeouts.map((closeout) => (
              <li
                key={closeout.id}
                className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
              >
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {formatDate(closeout.closeoutDate, "en-US")}
                </p>
                <p className="mt-2 text-sm text-[var(--color-stone-700)]">
                  <span className="font-medium">Promises:</span>{" "}
                  {closeout.promisesNote}
                </p>
                <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                  <span className="font-medium">What worked:</span>{" "}
                  {closeout.whatWorkedNote}
                </p>
                {closeout.factsLearnedNote ? (
                  <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                    <span className="font-medium">Facts learned:</span>{" "}
                    {closeout.factsLearnedNote}
                  </p>
                ) : null}
                {closeout.problemsNote ? (
                  <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                    <span className="font-medium">Problems:</span>{" "}
                    {closeout.problemsNote}
                  </p>
                ) : null}
                {closeout.helpRequestedNote ? (
                  <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                    <span className="font-medium">Help requested:</span>{" "}
                    {closeout.helpRequestedNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Recognition evidence
        </h2>
        {recognitionActs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No recognition recorded yet.
          </p>
        ) : (
          <ul
            className="mt-4 flex flex-col gap-4"
            aria-label="Recognition evidence"
          >
            {recognitionActs.map((act) => (
              <li
                key={act.id}
                className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={RECOGNITION_TONE[act.reviewState]}>
                    {act.reviewState}
                  </Badge>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {formatDate(act.occurredOn, "en-US")}
                  </p>
                </div>
                <p className="mt-2 text-sm text-[var(--color-stone-700)]">
                  {act.narrative}
                </p>
                {act.reviewedAt ? (
                  <p className="mt-2 text-xs text-[var(--color-stone-500)]">
                    Reviewed {formatDate(act.reviewedAt, "en-US")}
                    {act.reviewedByStaffId
                      ? ` by ${nameByStaffId.get(act.reviewedByStaffId) ?? "a manager"}`
                      : ""}
                  </p>
                ) : null}
                {act.coachingNote ? (
                  <p className="mt-1 text-sm text-[var(--color-stone-600)]">
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
