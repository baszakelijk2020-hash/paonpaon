import {
  CorporateOfficeVisitRepository,
  CorporateRepository,
  RetailerRepository,
} from "@paon/database";
import {
  CORPORATE_EXCEPTION_KINDS,
  computeEntitlementBalance,
  ENTITLEMENT_PERIODS,
  summarizeProgrammeReadiness,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { notFound } from "next/navigation";

import {
  createEntitlementVersion,
  createException,
  createWearer,
  recordIssue,
  resolveException,
  resolveOfficeVisitRequest,
  setWearerActive,
  setWearerLoginEmail,
} from "../actions";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const EXCEPTION_KIND_LABELS: Record<string, string> = {
  leaver_return: "Leaver return",
  service_required: "Service required",
  fit_issue: "Fit issue",
  entitlement_dispute: "Entitlement dispute",
};

export default async function CorporateProgrammePage({
  params,
}: {
  params: Promise<{ programmeId: string }>;
}) {
  const { programmeId } = await params;
  const session = await requireModuleSession("enterprise_verticals", "read");
  const client = await getSupabaseServerClient();
  const repo = new CorporateRepository(client);

  const programme = await repo.findProgrammeById(programmeId);
  if (!programme) notFound();

  const [
    account,
    versions,
    wearers,
    exceptions,
    officeVisitRequests,
    retailer,
  ] = await Promise.all([
    repo.findAccountById(programme.accountId),
    repo.findEntitlementVersions(programmeId),
    repo.findWearersByProgramme(programmeId),
    repo.findExceptionsByProgramme(programmeId),
    new CorporateOfficeVisitRepository(client).findByProgramme(programme.id),
    new RetailerRepository(client).findById(session.retailerId),
  ]);
  const customerAppBase = (
    process.env["NEXT_PUBLIC_CUSTOMER_APP_URL"] ?? "http://localhost:3002"
  ).replace(/\/$/, "");
  const latestVersion = versions[0] ?? null;
  const issuesByWearer = new Map(
    await Promise.all(
      wearers.map(
        async (wearer) =>
          [wearer.id, await repo.findIssuesByWearer(wearer.id)] as const,
      ),
    ),
  );
  const asOf = new Date().toISOString();
  const balancesByWearer = new Map(
    wearers.map((wearer) => {
      if (!latestVersion) return [wearer.id, []] as const;
      const balances = computeEntitlementBalance({
        version: {
          versionId: latestVersion.id,
          version: latestVersion.version,
          effectiveFrom: latestVersion.effectiveFrom,
          rules: latestVersion.rules,
        },
        roleKey: wearer.roleKey,
        joinedOn: wearer.joinedOn,
        issues: issuesByWearer.get(wearer.id) ?? [],
        asOf,
      });
      return [wearer.id, balances] as const;
    }),
  );
  // "fitted" is not observable from this schema — no appointment linkage
  // exists yet — so readiness here reports what corporate_issue_records can
  // actually tell us (has anything been issued), not a false tender signal.
  const readiness = summarizeProgrammeReadiness({
    wearers: wearers.map((wearer) => {
      const issued = (issuesByWearer.get(wearer.id) ?? []).length > 0;
      return {
        wearerId: wearer.id,
        fitted: false,
        ordered: issued,
        issued,
      };
    }),
  });
  const unresolvedExceptions = exceptions.filter((item) => !item.resolvedAt);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          {programme.name}
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          {account?.legalName ?? "Unknown account"} · {readiness.wearerCount}{" "}
          wearer{readiness.wearerCount === 1 ? "" : "s"} ·{" "}
          {readiness.issuedCount} issued at least one garment ·{" "}
          {unresolvedExceptions.length} open exception
          {unresolvedExceptions.length === 1 ? "" : "s"}
        </p>
      </div>

      {readiness.notStartedWearerIds.length > 0 ? (
        <Card className="border-[var(--color-warning-500)]/40">
          <p className="text-sm font-medium text-[var(--color-stone-900)]">
            {readiness.notStartedWearerIds.length} wearer
            {readiness.notStartedWearerIds.length === 1 ? "" : "s"} not started
          </p>
          <p className="text-sm text-[var(--color-stone-500)]">
            {readiness.notStartedWearerIds
              .map(
                (wearerId) =>
                  wearers.find((wearer) => wearer.id === wearerId)
                    ?.displayName ?? wearerId,
              )
              .join(", ")}
          </p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Entitlement version
          </h2>
          {latestVersion ? (
            <Badge tone="neutral">v{latestVersion.version}</Badge>
          ) : null}
        </div>
        {latestVersion ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                <th className="py-1">Role</th>
                <th className="py-1">Garment</th>
                <th className="py-1">Quantity</th>
                <th className="py-1">Period</th>
              </tr>
            </thead>
            <tbody>
              {latestVersion.rules.map((rule, index) => (
                <tr
                  key={index}
                  className="border-t border-[var(--color-stone-200)]"
                >
                  <td className="py-1.5">{rule.roleKey}</td>
                  <td className="py-1.5">{rule.garmentKey}</td>
                  <td className="py-1.5">{rule.quantity}</td>
                  <td className="py-1.5">{rule.period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-[var(--color-stone-500)]">
            No entitlement version yet — wearers cannot be issued garments until
            one exists.
          </p>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--color-stone-700)]">
            Publish a new version
          </summary>
          <form
            action={createEntitlementVersion.bind(null, programmeId)}
            className="mt-3 flex flex-col gap-3"
          >
            <FormField label="Effective from" htmlFor="effectiveFrom">
              <Input
                id="effectiveFrom"
                name="effectiveFrom"
                type="date"
                required
              />
            </FormField>
            <FormField
              label="Rules (JSON array)"
              htmlFor="rules"
              hint={`e.g. [{"roleKey":"associate","garmentKey":"suit","quantity":2,"period":"annual"}] — periods: ${ENTITLEMENT_PERIODS.join(", ")}`}
            >
              <textarea
                id="rules"
                name="rules"
                required
                rows={4}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-stone-300)] p-2 font-mono text-xs"
                placeholder='[{"roleKey":"associate","garmentKey":"suit","quantity":2,"period":"annual"}]'
              />
            </FormField>
            <Button type="submit" className="self-start">
              Publish version {(latestVersion?.version ?? 0) + 1}
            </Button>
          </form>
        </details>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Wearers
        </h2>
        {wearers.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No wearers yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {wearers.map((wearer) => {
              const balances = balancesByWearer.get(wearer.id) ?? [];
              return (
                <li key={wearer.id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-stone-900)]">
                        {wearer.displayName}{" "}
                        <span className="font-normal text-[var(--color-stone-500)]">
                          — {wearer.roleKey}
                        </span>
                      </p>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        {wearer.employeeReference} · joined {wearer.joinedOn}
                        {wearer.garmentAdaptationNote
                          ? ` · adaptation: ${wearer.garmentAdaptationNote}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={wearer.active ? "success" : "neutral"}>
                        {wearer.active ? "Active" : "Inactive"}
                      </Badge>
                      <form
                        action={setWearerActive.bind(
                          null,
                          programmeId,
                          wearer.id,
                          !wearer.active,
                        )}
                      >
                        <Button type="submit" variant="secondary" size="sm">
                          {wearer.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      </form>
                    </div>
                  </div>
                  <form
                    action={setWearerLoginEmail.bind(
                      null,
                      programmeId,
                      wearer.id,
                    )}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <FormField
                      label="Employee Portal login email"
                      htmlFor={`loginEmail-${wearer.id}`}
                      hint={
                        wearer.loginEmail
                          ? `Portal access: ${wearer.loginEmail}`
                          : "No portal access yet."
                      }
                    >
                      <Input
                        id={`loginEmail-${wearer.id}`}
                        name="loginEmail"
                        type="email"
                        defaultValue={wearer.loginEmail ?? ""}
                        placeholder="employee@company.com"
                      />
                    </FormField>
                    <Button type="submit" variant="secondary" size="sm">
                      {wearer.loginEmail ? "Update" : "Grant access"}
                    </Button>
                  </form>
                  {balances.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {balances.map((balance) => (
                        <Badge key={balance.garmentKey} tone="neutral">
                          {balance.garmentKey}: {balance.remainingQuantity}/
                          {balance.entitledQuantity} left
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {latestVersion ? (
                    <form
                      action={recordIssue.bind(null, programmeId)}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="wearerId" value={wearer.id} />
                      <input
                        type="hidden"
                        name="entitlementVersionId"
                        value={latestVersion.id}
                      />
                      <FormField
                        label="Garment"
                        htmlFor={`garment-${wearer.id}`}
                      >
                        <Select
                          id={`garment-${wearer.id}`}
                          name="garmentKey"
                          required
                        >
                          {balances.map((balance) => (
                            <option
                              key={balance.garmentKey}
                              value={balance.garmentKey}
                            >
                              {balance.garmentKey}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Qty" htmlFor={`qty-${wearer.id}`}>
                        <Input
                          id={`qty-${wearer.id}`}
                          name="quantity"
                          type="number"
                          min={1}
                          defaultValue={1}
                          required
                          className="w-16"
                        />
                      </FormField>
                      <FormField
                        label="Issued on"
                        htmlFor={`issued-${wearer.id}`}
                      >
                        <Input
                          id={`issued-${wearer.id}`}
                          name="issuedOn"
                          type="date"
                          required
                          defaultValue={asOf.slice(0, 10)}
                        />
                      </FormField>
                      <Button type="submit" size="sm">
                        Issue
                      </Button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--color-stone-700)]">
            Add a wearer
          </summary>
          <form
            action={createWearer.bind(null, programmeId)}
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
            <FormField label="Employee reference" htmlFor="employeeReference">
              <Input id="employeeReference" name="employeeReference" required />
            </FormField>
            <FormField label="Display name" htmlFor="displayName">
              <Input id="displayName" name="displayName" required />
            </FormField>
            <FormField label="Role key" htmlFor="roleKey">
              <Input id="roleKey" name="roleKey" required />
            </FormField>
            <FormField label="Joined on" htmlFor="joinedOn">
              <Input id="joinedOn" name="joinedOn" type="date" required />
            </FormField>
            <FormField label="Site key (optional)" htmlFor="siteKey">
              <Input id="siteKey" name="siteKey" />
            </FormField>
            <FormField
              label="Garment adaptation (optional, garment facts only)"
              htmlFor="garmentAdaptationNote"
              hint='e.g. "left sleeve +40mm" — never a diagnosis or reason'
            >
              <Input id="garmentAdaptationNote" name="garmentAdaptationNote" />
            </FormField>
            <Button type="submit" className="self-start sm:col-span-2">
              Add wearer
            </Button>
          </form>
        </details>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Exceptions
        </h2>
        {exceptions.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No exceptions logged.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {exceptions.map((exception) => (
              <li
                key={exception.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {EXCEPTION_KIND_LABELS[exception.kind] ?? exception.kind}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {exception.detail}
                  </p>
                </div>
                {exception.resolvedAt ? (
                  <Badge tone="success">Resolved</Badge>
                ) : (
                  <form
                    action={resolveException.bind(
                      null,
                      programmeId,
                      exception.id,
                    )}
                  >
                    <Button type="submit" variant="secondary" size="sm">
                      Resolve
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--color-stone-700)]">
            Log an exception
          </summary>
          <form
            action={createException.bind(null, programmeId)}
            className="mt-3 flex flex-col gap-3"
          >
            <FormField label="Wearer (optional)" htmlFor="wearerId">
              <Select id="wearerId" name="wearerId">
                <option value="">—</option>
                {wearers.map((wearer) => (
                  <option key={wearer.id} value={wearer.id}>
                    {wearer.displayName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Kind" htmlFor="kind">
              <Select id="kind" name="kind" required>
                {CORPORATE_EXCEPTION_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {EXCEPTION_KIND_LABELS[kind] ?? kind}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Detail" htmlFor="detail">
              <Input id="detail" name="detail" required minLength={5} />
            </FormField>
            <Button type="submit" className="self-start">
              Log exception
            </Button>
          </form>
        </details>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Office visit
          </h2>
          <p className="break-all text-xs text-[var(--color-stone-500)]">
            Public landing page: {customerAppBase}/r/{retailer?.slug}
            /corporate/{programme.id}
          </p>
        </div>
        {officeVisitRequests.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No visit requests yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {officeVisitRequests.map((request) => (
              <li
                key={request.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {request.requesterName}
                    {request.employeeReference
                      ? ` — ${request.employeeReference}`
                      : ""}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {[request.contactEmail, request.note]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {request.status === "open" || request.status === "contacted" ? (
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">
                      {request.status === "open" ? "Open" : "Contacted"}
                    </Badge>
                    {request.status === "open" ? (
                      <form
                        action={resolveOfficeVisitRequest.bind(
                          null,
                          programmeId,
                          request.id,
                          "contacted",
                        )}
                      >
                        <Button type="submit" variant="secondary" size="sm">
                          Mark contacted
                        </Button>
                      </form>
                    ) : null}
                    <form
                      action={resolveOfficeVisitRequest.bind(
                        null,
                        programmeId,
                        request.id,
                        "scheduled",
                      )}
                    >
                      <Button type="submit" variant="secondary" size="sm">
                        Scheduled
                      </Button>
                    </form>
                    <form
                      action={resolveOfficeVisitRequest.bind(
                        null,
                        programmeId,
                        request.id,
                        "declined",
                      )}
                    >
                      <Button type="submit" variant="secondary" size="sm">
                        Decline
                      </Button>
                    </form>
                  </div>
                ) : (
                  <Badge
                    tone={
                      request.status === "scheduled" ? "success" : "neutral"
                    }
                  >
                    {request.status === "scheduled" ? "Scheduled" : "Declined"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
