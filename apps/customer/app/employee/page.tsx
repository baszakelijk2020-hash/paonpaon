import { CorporateRepository } from "@paon/database";
import { computeEntitlementBalance } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";

import { RaiseRequestForm } from "./raise-request-form";

import { requireWearerAppSession } from "@/lib/session";
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
};

/**
 * The Employee Portal home (PHASE 18.5 / BD-105). Who the wearer is,
 * their programme, live entitlement balance and issue history — the
 * same `computeEntitlementBalance` the retailer-staff corporate page
 * already calls, never a second computation of the same number — plus
 * (PHASE 18.8) raising a service-desk request directly, the one owner-
 * boundary item from 18.5 the service desk unblocked.
 *
 * Still deliberately not here: appointments, orders and alterations —
 * those need the wearer's optional `customerId` link, which not every
 * wearer has. Shipping a page that silently shows nothing for those
 * would look like a bug; this page shows only what it can show honestly.
 */
export default async function EmployeePortalPage() {
  const session = await requireWearerAppSession();
  const repo = new CorporateRepository(await getSupabaseServerClient());

  const wearer = await repo.findWearerById(session.wearerId);
  if (!wearer) {
    return (
      <main className="mx-auto max-w-lg px-6 py-12">
        <p className="text-sm text-[var(--color-stone-700)]">
          Your employee record could not be found. Ask your programme
          administrator for help.
        </p>
      </main>
    );
  }

  const [programme, versions, issues, myRequests] = await Promise.all([
    repo.findProgrammeById(wearer.programmeId),
    repo.findEntitlementVersions(wearer.programmeId),
    repo.findIssuesByWearer(wearer.id),
    // RLS scopes this to the signed-in wearer's own rows only — the
    // wearer-select policy (18.8) is the only one their session
    // satisfies, so this never leaks a colleague's request.
    repo.findExceptionsByProgramme(wearer.programmeId),
  ]);
  const latestVersion = versions[0] ?? null;
  const balances = latestVersion
    ? computeEntitlementBalance({
        version: {
          versionId: latestVersion.id,
          version: latestVersion.version,
          effectiveFrom: latestVersion.effectiveFrom,
          rules: latestVersion.rules,
        },
        roleKey: wearer.roleKey,
        joinedOn: wearer.joinedOn,
        issues,
        asOf: new Date().toISOString(),
      })
    : [];

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-12">
      <div>
        <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
          Employee Portal
        </p>
        <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
          {wearer.displayName}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          {programme?.name ?? "Programme"}
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Your entitlement
        </h2>
        {balances.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No entitlement policy is active yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {balances.map((balance) => (
              <li
                key={balance.garmentKey}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-[var(--color-stone-900)]">
                  {balance.garmentKey}
                </span>
                <span className="text-[var(--color-stone-500)]">
                  {balance.remainingQuantity}/{balance.entitledQuantity} left
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Issued to you
        </h2>
        {issues.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            Nothing issued yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {issues.map((issue) => (
              <li key={issue.id} className="py-2 text-sm">
                <span className="text-[var(--color-stone-900)]">
                  {issue.garmentKey}
                </span>{" "}
                <span className="text-[var(--color-stone-500)]">
                  ×{issue.quantity} — {issue.issuedOn}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Report a problem
        </h2>
        {myRequests.length > 0 ? (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {myRequests.map((request) => (
              <li
                key={request.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <p className="text-[var(--color-stone-900)]">
                    {KIND_LABELS[request.kind] ?? request.kind}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {request.detail}
                  </p>
                </div>
                <Badge tone={request.resolvedAt ? "success" : "neutral"}>
                  {request.resolvedAt ? "Resolved" : "Open"}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <RaiseRequestForm />
      </Card>
    </main>
  );
}
