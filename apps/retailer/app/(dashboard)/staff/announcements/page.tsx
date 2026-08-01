import {
  InternalCommunityRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import {
  AcknowledgeAnnouncementForm,
  PublishAnnouncementForm,
} from "./announcement-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const RETAILER_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  sales_associate: "Sales Associate",
  production_staff: "Production Staff",
  workshop_manager: "Workshop Manager",
  worker: "Workshop Staff",
  read_only: "Read Only",
};

export default async function AnnouncementsPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const staffRepo = new RetailerStaffRepository(supabase);
  const communityRepo = new InternalCommunityRepository(supabase);

  const [team, viewer] = await Promise.all([
    staffRepo.findByRetailer(session.retailerId),
    staffRepo.findByUserId(session.userId),
  ]);

  // Fetch with correct staffId
  if (viewer) {
    const [correctAnnouncements, correctAcknowledged] = await Promise.all([
      communityRepo.listAnnouncementsFor({
        retailerId: session.retailerId,
        viewer: {
          staffId: viewer.id,
          role: viewer.role,
        },
        limit: 50,
      }),
      supabase
        .from("staff_announcement_acknowledgements")
        .select("announcement_id")
        .eq("staff_id", viewer.id),
    ]);

    const isManager = retailerRoleAtLeast(session.retailerRole, "manager");

    const acknowledgedIds = new Set<string>(
      (correctAcknowledged.data ?? []).map((row) => row.announcement_id),
    );

    const nameByStaffId = new Map<string, string>(
      team.map((m) => [m.id as string, m.fullName]),
    );

    // Build audience options for the form
    const audienceOptions = [
      { value: "everyone", label: "Everyone" },
      ...Array.from(new Set(team.map((m) => m.role)))
        .sort()
        .map((role) => ({
          value: `role:${role}`,
          label: RETAILER_ROLE_LABELS[role] ?? role,
        })),
    ];

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            Announcements
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            Team updates and important notices
          </p>
        </div>

        {isManager ? (
          <Card>
            <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
              Publish announcement
            </h2>
            <PublishAnnouncementForm audienceOptions={audienceOptions} />
          </Card>
        ) : null}

        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Your announcements ({correctAnnouncements.length})
          </h2>
          {correctAnnouncements.length === 0 ? (
            // Designed, not defaulted. "Check back later" is the wrong
            // instruction for someone looking at a publish form: they are the
            // person who makes the first one exist.
            <p
              id="announcement-feed-empty"
              className="mt-3 text-sm text-[var(--color-stone-500)]"
            >
              Nothing posted yet. Anything you publish here reaches the team on
              their next shift, and you can ask them to confirm they have read
              it.
            </p>
          ) : (
            <ul id="announcement-feed" className="mt-3 flex flex-col gap-4">
              {correctAnnouncements.map((ann) => {
                const hasAcknowledged = acknowledgedIds.has(ann.id);
                const requiresAck = ann.requires_acknowledgement;
                const showAckButton = requiresAck && !hasAcknowledged && viewer;

                // Determine audience label
                let audienceLabel = "Everyone";
                if (ann.audience_roles && ann.audience_roles.length > 0) {
                  audienceLabel = ann.audience_roles
                    .map((role: string) => RETAILER_ROLE_LABELS[role] ?? role)
                    .join(", ");
                }

                return (
                  <li
                    key={ann.id}
                    data-announcement-id={ann.id}
                    data-acknowledged={hasAcknowledged ? "true" : "false"}
                    className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--color-stone-900)]">
                          {ann.title}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                          {audienceLabel} ·{" "}
                          {formatDate(
                            ann.published_at || ann.created_at,
                            "en-US",
                          )}
                        </p>
                        <p className="mt-2 text-sm text-[var(--color-stone-700)]">
                          {ann.body}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                        {showAckButton ? (
                          <AcknowledgeAnnouncementForm
                            announcementId={ann.id}
                          />
                        ) : hasAcknowledged && requiresAck ? (
                          <Badge tone="success">Read</Badge>
                        ) : null}
                      </div>
                    </div>

                    {isManager && requiresAck && viewer ? (
                      <ReachSummary
                        announcementId={ann.id}
                        team={team}
                        nameByStaffId={nameByStaffId}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  // Fallback if viewer not found (should not happen with requireSession)
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Announcements
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Team updates and important notices
        </p>
      </div>
      <Card>
        <p className="text-sm text-[var(--color-stone-500)]">
          Your staff record could not be found.
        </p>
      </Card>
    </div>
  );
}

/**
 * Display reach summary for a manager — how many have read, who has not yet read.
 */
async function ReachSummary({
  announcementId,
  team,
  nameByStaffId,
}: {
  readonly announcementId: string;
  readonly team: Array<{ id?: string; fullName: string; role: string }>;
  readonly nameByStaffId: Map<string, string>;
}) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const communityRepo = new InternalCommunityRepository(supabase);

  const reach = await communityRepo.announcementReach({
    retailerId: session.retailerId,
    announcementId,
    staff: team.map((m) => ({
      staffId: m.id ?? "",
      role: m.role,
    })),
  });

  const unreadNames = reach.outstandingStaffIds
    .map((id) => nameByStaffId.get(id) ?? "Unknown")
    .join(", ");

  return (
    <div
      // Scoped to the announcement: this block renders once per item in the
      // feed, and a literal id would repeat down the page.
      data-announcement-reach={announcementId}
      className="mt-2 border-t border-[var(--color-stone-100)] pt-2 text-xs text-[var(--color-stone-500)]"
    >
      <p>
        {reach.acknowledgedCount} of {reach.audienceSize} have read this.
      </p>
      {unreadNames ? (
        <p className="mt-1">Not yet read by: {unreadNames}.</p>
      ) : null}
    </div>
  );
}
