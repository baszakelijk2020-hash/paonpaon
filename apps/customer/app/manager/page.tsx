import { CorporateRepository } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import { requireCorporateManagerAppSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const KIND_LABELS: Record<string, string> = {
  damaged: "Damaged",
  missing: "Missing",
  fit_issue: "Fit issue",
  alteration_request: "Alteration request",
  replacement_request: "Replacement request",
  leaver_return: "Leaver return",
  service_required: "Service required",
  entitlement_dispute: "Entitlement dispute",
  repair: "Repair",
};

/**
 * The Manager Portal home (PHASE 14.1 / BD-104). The account manager views
 * their corporate account's programmes, wearers, open exceptions, and
 * announcements — everything needed to administer an employee wardrobe
 * programme. Unlike a retailer staff member who manages multiple accounts,
 * a manager sees only their own account's data, scoped by RLS.
 *
 * A manager can raise exceptions on behalf of a wearer and publish/draft
 * announcements. They get no write access to wearer roster, entitlement
 * versions, or issue records — those stay retailer-staff-only.
 */
export default async function ManagerPortalPage() {
  const session = await requireCorporateManagerAppSession();
  const supabase = await getSupabaseServerClient();
  const repo = new CorporateRepository(supabase);

  const manager = await repo.findManagerById(session.managerId);
  if (!manager) {
    return (
      <main className="mx-auto max-w-lg px-6 py-12">
        <p className="text-sm text-[var(--color-stone-700)]">
          Your manager record could not be found. Ask your retailer for help.
        </p>
      </main>
    );
  }

  const account = await repo.findAccountById(manager.accountId);
  if (!account) {
    return (
      <main className="mx-auto max-w-lg px-6 py-12">
        <p className="text-sm text-[var(--color-stone-700)]">
          Your account record could not be found. Ask your retailer for help.
        </p>
      </main>
    );
  }

  const programmes = await repo.findProgrammesByAccount(manager.accountId);
  if (programmes.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-6 py-12">
        <div>
          <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-700)]">
            Manager Portal
          </p>
          <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
            {account.legalName}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-stone-700)]">
            {manager.contactName}
          </p>
        </div>
        <p className="mt-6 text-sm text-[var(--color-stone-700)]">
          No programmes yet. Your retailer will set them up for you.
        </p>
      </main>
    );
  }

  const firstProgramme = programmes[0]!;
  const [wearers, exceptions, announcements] = await Promise.all([
    repo.findWearersByProgramme(firstProgramme.id),
    repo.findExceptionsByProgramme(firstProgramme.id),
    // Manager sees draft + published announcements (RLS allows it), unlike
    // wearer who only sees published
    repo.findAnnouncementsByProgramme(firstProgramme.id),
  ]);

  const activeWearers = wearers.filter((w) => w.active);
  const openExceptions = exceptions.filter((e) => !e.resolvedAt);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-12">
      <div>
        <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-700)]">
          Manager Portal
        </p>
        <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
          {account.legalName}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-stone-700)]">
          {manager.contactName}
        </p>
      </div>

      {programmes.length > 1 ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Programmes
          </h2>
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {programmes.map((prog) => (
              <li key={prog.id} className="py-2 text-sm">
                <p className="text-[var(--color-stone-900)]">{prog.name}</p>
                {prog.siteKeys.length > 0 ? (
                  <p className="text-xs text-[var(--color-stone-700)]">
                    {prog.siteKeys.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          {firstProgramme.name} — Wearers
        </h2>
        {activeWearers.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-700)]">
            No active wearers yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {activeWearers.map((wearer) => (
              <li
                key={wearer.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <p className="text-[var(--color-stone-900)]">
                    {wearer.displayName}
                  </p>
                  <p className="text-xs text-[var(--color-stone-700)]">
                    {wearer.roleKey}
                  </p>
                </div>
                {wearer.active ? (
                  <Badge tone="success">Active</Badge>
                ) : (
                  <Badge tone="neutral">Inactive</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {announcements.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Announcements
          </h2>
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {announcements.map((announcement) => (
              <li key={announcement.id} className="flex flex-col gap-1 py-2">
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {announcement.title}
                </p>
                <p className="text-sm text-[var(--color-stone-700)]">
                  {announcement.body}
                </p>
                <div className="flex items-center justify-between gap-2">
                  {announcement.publishedAt ? (
                    <p className="text-xs text-[var(--color-stone-700)]">
                      Published {formatDate(announcement.publishedAt, "en-US")}
                    </p>
                  ) : (
                    <Badge tone="neutral">Draft</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {openExceptions.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Open issues
          </h2>
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {openExceptions.map((exception) => (
              <li
                key={exception.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <p className="text-[var(--color-stone-900)]">
                    {KIND_LABELS[exception.kind] ?? exception.kind}
                  </p>
                  <p className="text-xs text-[var(--color-stone-700)]">
                    {exception.detail}
                  </p>
                </div>
                <Badge tone="neutral">Open</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </main>
  );
}
