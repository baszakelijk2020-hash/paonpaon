import {
  CitedRecommendationRepository,
  CorporateOfficeVisitRepository,
  CorporateRepository,
  CorporateRolloutRepository,
  RetailerRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  computeEntitlementBalance,
  CORPORATE_EXCEPTION_KINDS,
  CORPORATE_EXCEPTION_PRIORITIES,
  ENTITLEMENT_PERIODS,
  isExceptionOverdue,
  summarizeProgrammeReadiness,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { DateTimePicker } from "@paon/ui/components/DateTimePicker";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { notFound } from "next/navigation";

import {
  assignExceptionToStaff,
  assignWearerToRolloutDay,
  changeExceptionPriority,
  createEntitlementVersion,
  createException,
  createRolloutDay,
  createWearer,
  markRolloutSlotCompleted,
  markRolloutSlotNoShow,
  recomputeRenewalRisk,
  recordIssue,
  resolveException,
  resolveOfficeVisitRequest,
  resolveRenewalTask,
  scheduleOfficeVisitAppointment,
  setContractValue,
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
  damaged: "Damaged",
  missing: "Missing",
  alteration_request: "Alteration request",
  replacement_request: "Replacement request",
  repair: "Repair",
};

const EXCEPTION_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
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
    rolloutDays,
    rolloutSlots,
    staffMembers,
    liveRenewalRiskRows,
    openRenewalTask,
  ] = await Promise.all([
    repo.findAccountById(programme.accountId),
    repo.findEntitlementVersions(programmeId),
    repo.findWearersByProgramme(programmeId),
    repo.findExceptionsByProgramme(programmeId),
    new CorporateOfficeVisitRepository(client).findByProgramme(programme.id),
    new RetailerRepository(client).findById(session.retailerId),
    new CorporateRolloutRepository(client).findDaysByProgramme(programme.id),
    new CorporateRolloutRepository(client).findSlotsByProgramme(programme.id),
    new RetailerStaffRepository(client).findByRetailer(session.retailerId),
    new CitedRecommendationRepository(client).listLive({
      retailerId: session.retailerId,
      kind: "corporate_renewal_risk",
    }),
    repo.findOpenRenewalTask(programmeId),
  ]);
  const renewalRiskRecommendation = liveRenewalRiskRows.find((row) =>
    (row.sources as unknown as { sourceRef: string }[]).some(
      (s) => s.sourceRef === `corporate_programme:${programme.id}`,
    ),
  );
  const staffById = new Map<string, (typeof staffMembers)[number]>(
    staffMembers.map((s) => [s.id, s]),
  );
  const nowIso = new Date().toISOString();
  const wearersById = new Map<string, (typeof wearers)[number]>(
    wearers.map((w) => [w.id, w]),
  );
  const plannedSlotsByDay = new Map<
    string,
    (typeof rolloutSlots extends readonly (infer S)[] ? S : never)[]
  >();
  for (const slot of rolloutSlots) {
    if (slot.status !== "planned") continue;
    const list = plannedSlotsByDay.get(slot.rolloutDayId) ?? [];
    list.push(slot);
    plannedSlotsByDay.set(slot.rolloutDayId, list);
  }
  const activelyPlannedWearerIds = new Set(
    rolloutSlots.filter((s) => s.status === "planned").map((s) => s.wearerId),
  );
  const unassignedWearers = wearers.filter(
    (w) => w.active && !activelyPlannedWearerIds.has(w.id),
  );
  // A no-show whose auto-reslot found no spare capacity anywhere —
  // stuck with no current planned slot, needing a person to solve it,
  // not silently forgotten. `unassignedWearers` already includes them;
  // this is the subset also worth calling out with their miss history.
  const strandedNoShowWearerIds = new Set(
    rolloutSlots
      .filter(
        (s) =>
          s.status === "no_show" && !activelyPlannedWearerIds.has(s.wearerId),
      )
      .map((s) => s.wearerId),
  );
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
            {exceptions.map((exception) => {
              const overdue = isExceptionOverdue({
                ...(exception.dueAt ? { dueAt: exception.dueAt } : {}),
                ...(exception.resolvedAt
                  ? { resolvedAt: exception.resolvedAt }
                  : {}),
                now: nowIso,
              });
              const assignedStaff = exception.assignedStaffId
                ? staffById.get(exception.assignedStaffId)
                : undefined;
              return (
                <li key={exception.id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-stone-900)]">
                        {EXCEPTION_KIND_LABELS[exception.kind] ??
                          exception.kind}
                      </p>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        {exception.detail}
                      </p>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        {exception.priority
                          ? EXCEPTION_PRIORITY_LABELS[exception.priority]
                          : "Normal"}{" "}
                        priority
                        {assignedStaff
                          ? ` · assigned to ${assignedStaff.fullName}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {exception.resolvedAt ? (
                        <Badge tone="success">Resolved</Badge>
                      ) : overdue ? (
                        <Badge tone="danger">Overdue</Badge>
                      ) : (
                        <Badge tone="neutral">Open</Badge>
                      )}
                    </div>
                  </div>
                  {!exception.resolvedAt ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <form
                        action={changeExceptionPriority.bind(null, programmeId)}
                        className="flex items-end gap-2"
                      >
                        <input
                          type="hidden"
                          name="exceptionId"
                          value={exception.id}
                        />
                        <FormField
                          label="Priority"
                          htmlFor={`priority-${exception.id}`}
                        >
                          <Select
                            id={`priority-${exception.id}`}
                            name="priority"
                            defaultValue={exception.priority ?? "normal"}
                          >
                            {CORPORATE_EXCEPTION_PRIORITIES.map((priority) => (
                              <option key={priority} value={priority}>
                                {EXCEPTION_PRIORITY_LABELS[priority]}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                        <Button type="submit" variant="secondary" size="sm">
                          Update priority
                        </Button>
                      </form>
                      <form
                        action={assignExceptionToStaff.bind(null, programmeId)}
                        className="flex items-end gap-2"
                      >
                        <input
                          type="hidden"
                          name="exceptionId"
                          value={exception.id}
                        />
                        <FormField
                          label="Assign to"
                          htmlFor={`assign-staff-${exception.id}`}
                        >
                          <Select
                            id={`assign-staff-${exception.id}`}
                            name="staffId"
                            required
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Choose staff
                            </option>
                            {staffMembers.map((staff) => (
                              <option key={staff.id} value={staff.id}>
                                {staff.fullName}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                        <Button type="submit" variant="secondary" size="sm">
                          Assign
                        </Button>
                      </form>
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
                    </div>
                  ) : null}
                </li>
              );
            })}
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
            <FormField label="Priority" htmlFor="priority">
              <Select id="priority" name="priority" defaultValue="normal">
                {CORPORATE_EXCEPTION_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {EXCEPTION_PRIORITY_LABELS[priority]}
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
                    {request.contactEmail ? (
                      <details>
                        <summary className="cursor-pointer text-sm text-[var(--color-stone-700)] underline">
                          Schedule appointment
                        </summary>
                        <form
                          action={scheduleOfficeVisitAppointment.bind(
                            null,
                            programmeId,
                            request.id,
                          )}
                          className="mt-3 flex flex-col gap-3"
                        >
                          <FormField
                            label="Starts"
                            htmlFor="startsAt"
                            labelledGroup
                          >
                            <DateTimePicker name="startsAt" label="Starts" />
                          </FormField>
                          <FormField
                            label="Ends"
                            htmlFor="endsAt"
                            labelledGroup
                          >
                            <DateTimePicker name="endsAt" label="Ends" />
                          </FormField>
                          <Button
                            type="submit"
                            size="sm"
                            className="self-start"
                          >
                            Book real appointment
                          </Button>
                        </form>
                      </details>
                    ) : (
                      <form
                        action={resolveOfficeVisitRequest.bind(
                          null,
                          programmeId,
                          request.id,
                          "scheduled",
                        )}
                      >
                        <Button type="submit" variant="secondary" size="sm">
                          Scheduled (no contact email on file)
                        </Button>
                      </form>
                    )}
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
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        request.status === "scheduled" ? "success" : "neutral"
                      }
                    >
                      {request.status === "scheduled"
                        ? "Scheduled"
                        : "Declined"}
                    </Badge>
                    {request.status === "scheduled" && request.appointmentId ? (
                      <span
                        className="text-xs text-[var(--color-stone-500)]"
                        data-office-visit-appointment-booked
                      >
                        Appointment booked
                      </span>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Fitting rollout
        </h2>
        {rolloutDays.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No fitting days planned yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {rolloutDays.map((day) => {
              const planned = plannedSlotsByDay.get(day.id) ?? [];
              return (
                <div
                  key={day.id}
                  data-rollout-day={day.fittingDate}
                  className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--color-stone-900)]">
                        {day.fittingDate}
                      </p>
                      {day.siteKey ? (
                        <Badge tone="neutral">{day.siteKey}</Badge>
                      ) : null}
                    </div>
                    <Badge
                      tone={
                        planned.length >= day.capacity ? "warning" : "neutral"
                      }
                    >
                      {planned.length}/{day.capacity}
                    </Badge>
                  </div>
                  {day.advisorNote ? (
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {day.advisorNote}
                    </p>
                  ) : null}
                  {planned.length > 0 ? (
                    <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
                      {planned.map((slot) => (
                        <li
                          key={slot.id}
                          className="flex items-center justify-between gap-2 py-1.5 text-sm"
                        >
                          <span className="text-[var(--color-stone-900)]">
                            {wearersById.get(slot.wearerId)?.displayName ??
                              slot.wearerId}
                          </span>
                          <div className="flex items-center gap-2">
                            <form
                              action={markRolloutSlotCompleted.bind(
                                null,
                                programmeId,
                                slot.id,
                              )}
                            >
                              <Button
                                type="submit"
                                variant="secondary"
                                size="sm"
                              >
                                Completed
                              </Button>
                            </form>
                            <form
                              action={markRolloutSlotNoShow.bind(
                                null,
                                programmeId,
                                slot.id,
                              )}
                            >
                              <Button
                                type="submit"
                                variant="secondary"
                                size="sm"
                              >
                                No-show
                              </Button>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {(() => {
                    // Department/location grouping (PHASE 18.6): a
                    // site-scoped day only ever offers wearers from that
                    // same site; a company-wide day (no siteKey) offers
                    // everyone unassigned, exactly as before.
                    const eligibleWearers = day.siteKey
                      ? unassignedWearers.filter(
                          (wearer) => wearer.siteKey === day.siteKey,
                        )
                      : unassignedWearers;
                    return eligibleWearers.length > 0 &&
                      planned.length < day.capacity ? (
                      <form
                        action={assignWearerToRolloutDay.bind(
                          null,
                          programmeId,
                        )}
                        className="flex flex-wrap items-end gap-2 pt-1"
                      >
                        <input
                          type="hidden"
                          name="rolloutDayId"
                          value={day.id}
                        />
                        <input
                          type="hidden"
                          name="capacity"
                          value={day.capacity}
                        />
                        {day.siteKey ? (
                          <input
                            type="hidden"
                            name="daySiteKey"
                            value={day.siteKey}
                          />
                        ) : null}
                        <FormField
                          label="Assign wearer"
                          htmlFor={`assign-${day.id}`}
                        >
                          <Select
                            id={`assign-${day.id}`}
                            name="wearerId"
                            required
                          >
                            {eligibleWearers.map((wearer) => (
                              <option key={wearer.id} value={wearer.id}>
                                {wearer.displayName}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                        <Button type="submit" variant="secondary" size="sm">
                          Assign
                        </Button>
                      </form>
                    ) : null;
                  })()}
                </div>
              );
            })}
          </div>
        )}

        {strandedNoShowWearerIds.size > 0 ? (
          <div className="border-[var(--color-warning-500)]/40 rounded-[var(--radius-md)] border p-3">
            <p className="text-sm font-medium text-[var(--color-stone-900)]">
              No-shows awaiting a new day
            </p>
            <p className="text-xs text-[var(--color-stone-500)]">
              No fitting day currently has spare capacity for:{" "}
              {[...strandedNoShowWearerIds]
                .map((id) => wearersById.get(id)?.displayName ?? id)
                .join(", ")}
              . Add another fitting day to reslot them.
            </p>
          </div>
        ) : null}

        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--color-stone-700)]">
            Add a fitting day
          </summary>
          <form
            action={createRolloutDay.bind(null, programmeId)}
            className="mt-3 grid gap-3 sm:grid-cols-3"
          >
            <FormField label="Date" htmlFor="fittingDate">
              <Input id="fittingDate" name="fittingDate" type="date" required />
            </FormField>
            <FormField label="Capacity" htmlFor="capacity">
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                required
              />
            </FormField>
            <FormField label="Advisor note (optional)" htmlFor="advisorNote">
              <Input id="advisorNote" name="advisorNote" />
            </FormField>
            <FormField
              label="Site key (optional)"
              htmlFor="siteKey"
              hint="Leave blank for a company-wide day open to any wearer; set it to scope this day to one site."
            >
              <Input id="siteKey" name="siteKey" />
            </FormField>
            <Button type="submit" className="self-start sm:col-span-3">
              Add fitting day
            </Button>
          </form>
        </details>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Analytics and renewal
          </h2>
          <form action={recomputeRenewalRisk.bind(null, programmeId)}>
            <Button type="submit" variant="secondary" size="sm">
              Recompute
            </Button>
          </form>
        </div>

        <form
          action={setContractValue.bind(null, programmeId)}
          className="flex flex-wrap items-end gap-2 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3"
        >
          <FormField label="Contract value (minor units)" htmlFor="valueMinor">
            <Input
              id="valueMinor"
              name="contractValueMinorUnits"
              type="number"
              min={0}
              defaultValue={
                (programme as unknown as Record<string, number | string>)
                  ?.contract_value_minor_units ?? ""
              }
              placeholder="0"
            />
          </FormField>
          <FormField label="Currency" htmlFor="currency">
            <Input
              id="currency"
              name="contractValueCurrency"
              type="text"
              maxLength={3}
              defaultValue={
                (programme as unknown as Record<string, number | string>)
                  ?.contract_value_currency ?? ""
              }
              placeholder="GBP"
            />
          </FormField>
          <Button type="submit" variant="secondary" size="sm">
            Set contract value
          </Button>
        </form>

        {renewalRiskRecommendation ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-[var(--color-stone-700)]">
              {renewalRiskRecommendation.statement}
            </p>
            <p className="text-xs text-[var(--color-stone-500)]">
              Sample size {renewalRiskRecommendation.sample_size} ·{" "}
              {renewalRiskRecommendation.confidence}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-stone-500)]">
            Not computed yet — press Recompute.
          </p>
        )}
        {openRenewalTask ? (
          <div className="border-[var(--color-warning-500)]/40 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border p-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-stone-900)]">
                Renewal task open
              </p>
              <p className="text-xs text-[var(--color-stone-500)]">
                {openRenewalTask.reason}
              </p>
            </div>
            <form
              action={resolveRenewalTask.bind(
                null,
                programmeId,
                openRenewalTask.id,
              )}
            >
              <Button type="submit" variant="secondary" size="sm">
                Mark done
              </Button>
            </form>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
