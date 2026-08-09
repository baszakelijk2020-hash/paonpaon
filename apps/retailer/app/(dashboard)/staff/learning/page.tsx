import {
  AcademyRepository,
  AcademyRoleplayRepository,
  InternalCommunityRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  ACADEMY_ROLEPLAY_PERSONA_LABELS,
  retailerRoleAtLeast,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import {
  ModerateContributionForm,
  RecordRoleplayGradeForm,
  SubmitContributionForm,
} from "./learning-forms";
import { RoleplayPractice } from "./roleplay-practice";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function LearningPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const staffRepo = new RetailerStaffRepository(supabase);
  const communityRepo = new InternalCommunityRepository(supabase);
  const viewer = await staffRepo.findByUserId(session.userId);

  if (!viewer) {
    return (
      <div className="flex flex-col gap-6">
        <Heading />
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            Your staff record could not be found.
          </p>
        </Card>
      </div>
    );
  }

  const isManager = retailerRoleAtLeast(session.retailerRole, "manager");
  const academyRepo = new AcademyRepository(supabase);
  const roleplayRepo = new AcademyRoleplayRepository(supabase);

  const [
    approved,
    mine,
    queue,
    allStaff,
    myGrades,
    activeRoleplaySession,
    completedRoleplaySessions,
  ] = await Promise.all([
    communityRepo.listApprovedContributions({
      retailerId: session.retailerId,
    }),
    communityRepo.listContributionsByAuthor({
      retailerId: session.retailerId,
      authorStaffId: viewer.id,
    }),
    isManager
      ? communityRepo.listSubmittedContributions({
          retailerId: session.retailerId,
        })
      : Promise.resolve([]),
    isManager
      ? staffRepo.findByRetailer(session.retailerId)
      : Promise.resolve([]),
    academyRepo.listGradesForStaff({
      retailerId: session.retailerId,
      staffId: viewer.id,
    }),
    roleplayRepo.findActiveSessionForStaff(viewer.id),
    isManager
      ? roleplayRepo.findCompletedSessionsForRetailer(session.retailerId)
      : Promise.resolve([]),
  ]);
  const staffNameById = new Map(
    allStaff.map((member) => [String(member.id), member.fullName]),
  );
  const roleplaySessionOptions = completedRoleplaySessions.map((rp) => ({
    id: rp.id,
    label: `${staffNameById.get(rp.staffId) ?? "Unknown"} · ${ACADEMY_ROLEPLAY_PERSONA_LABELS[rp.personaKey].split(" — ")[0]} · ${formatDate(rp.startedAt, "en-US")}`,
  }));
  const staffOptions = allStaff
    .filter((member) => member.id !== viewer.id)
    .map((member) => ({ id: member.id, label: member.fullName }));
  const activeRoleplayMessages = activeRoleplaySession
    ? await roleplayRepo.findMessagesBySession(activeRoleplaySession.id)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <Heading />

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Share what you know
        </h2>
        <SubmitContributionForm />
      </Card>

      {isManager ? (
        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Awaiting review ({queue.length})
          </h2>
          {queue.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-stone-500)]">
              Nothing waiting.
            </p>
          ) : (
            <ul id="learning-queue" className="mt-3 flex flex-col gap-4">
              {queue.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
                >
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {item.title}{" "}
                    <span className="font-normal text-[var(--color-stone-500)]">
                      v{item.version}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-stone-700)]">
                    {item.body}
                  </p>
                  <ModerateContributionForm contributionId={item.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Your contributions ({mine.length})
        </h2>
        {mine.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            Nothing submitted yet.
          </p>
        ) : (
          <ul id="learning-mine" className="mt-3 flex flex-col gap-3">
            {mine.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 border-b border-[var(--color-stone-100)] pb-3 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {item.title} (v{item.version})
                  </p>
                  <StateBadge state={item.state} />
                </div>
                {item.state === "rejected" && item.moderation_note ? (
                  <p className="text-xs text-[var(--color-stone-500)]">
                    Reviewer note: {item.moderation_note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Published ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            Nothing published yet.
          </p>
        ) : (
          <ul id="learning-approved" className="mt-3 flex flex-col gap-4">
            {approved.map((item) => (
              <li
                key={item.id}
                className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
              >
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {item.title}
                </p>
                <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                  Approved{" "}
                  {item.moderated_at
                    ? formatDate(item.moderated_at, "en-US")
                    : ""}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-stone-700)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Practice with an AI persona
        </h2>
        <p className="mt-1 text-xs text-[var(--color-stone-500)]">
          Practice a real conversation against one of the published personas
          before a manager grades it.
        </p>
        <RoleplayPractice
          activeSession={activeRoleplaySession}
          activeMessages={activeRoleplayMessages}
        />
      </Card>

      {isManager ? (
        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Record a roleplay grade
          </h2>
          <p className="mt-1 text-xs text-[var(--color-stone-500)]">
            Every grade cites what was actually observed and where — an
            ungrounded grade teaches nothing and cannot be disputed.
          </p>
          <RecordRoleplayGradeForm
            staff={staffOptions}
            roleplaySessions={roleplaySessionOptions}
          />
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Your roleplay grades ({myGrades.length})
        </h2>
        {myGrades.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No graded roleplay yet.
          </p>
        ) : (
          <ul id="learning-grades" className="mt-3 flex flex-col gap-3">
            {myGrades.map((grade) => (
              <li
                key={grade.id}
                data-grade-id={grade.id}
                className="flex flex-col gap-1 border-b border-[var(--color-stone-100)] pb-3 last:border-0"
              >
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {grade.lessonKey}
                  {grade.personaKey ? (
                    <span className="ml-2 text-xs font-normal text-[var(--color-stone-500)]">
                      ·{" "}
                      {
                        ACADEMY_ROLEPLAY_PERSONA_LABELS[grade.personaKey].split(
                          " — ",
                        )[0]
                      }
                    </span>
                  ) : null}
                </p>
                {grade.evidence.map((item, index) => (
                  <p
                    key={index}
                    className="text-xs text-[var(--color-stone-700)]"
                  >
                    <span className="font-medium">{item.criterionKey}:</span>{" "}
                    {item.observedBehaviour}{" "}
                    <span className="text-[var(--color-stone-500)]">
                      ({item.evidenceRef})
                    </span>
                  </p>
                ))}
                <p className="text-xs text-[var(--color-stone-500)]">
                  {formatDate(grade.createdAt, "en-US")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Heading() {
  return (
    <div>
      <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
        Learning
      </h1>
      <p className="text-sm text-[var(--color-stone-500)]">
        Share what you know; moderated before it&apos;s shared
      </p>
    </div>
  );
}

function StateBadge({ state }: { readonly state: string }) {
  if (state === "approved") return <Badge tone="success">Published</Badge>;
  if (state === "rejected") return <Badge tone="danger">Rejected</Badge>;
  if (state === "submitted")
    return <Badge tone="warning">Awaiting review</Badge>;
  return <Badge tone="neutral">{state}</Badge>;
}
