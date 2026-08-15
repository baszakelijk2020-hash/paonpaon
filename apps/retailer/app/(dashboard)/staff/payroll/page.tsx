import { requireRetailerRole } from "@paon/auth";
import {
  PayrollPeriodRepository,
  RetailerStaffRepository,
  type PayrollPeriodVersionRecord,
} from "@paon/database";
import { summarizePeriodHours } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { redirect } from "next/navigation";

import {
  ApprovePayrollPeriodForm,
  CorrectPayrollEntryForm,
  OpenPayrollPeriodForm,
  RecordPayrollExportForm,
  ResolvePayrollExceptionForm,
} from "./payroll-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function PayrollPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/staff");
  }
  const supabase = await getSupabaseServerClient();
  const [dashboard, staff] = await Promise.all([
    new PayrollPeriodRepository(supabase).findDashboard(session.retailerId),
    new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
  ]);
  const staffName = new Map(
    staff.map((member) => [member.id as string, member.fullName]),
  );
  const versions = new Map(
    dashboard.versions.map((version) => [version.id, version]),
  );
  const snapshotsByVersion = new Map<string, typeof dashboard.snapshots>();
  for (const snapshot of dashboard.snapshots)
    snapshotsByVersion.set(snapshot.versionId, [
      ...(snapshotsByVersion.get(snapshot.versionId) ?? []),
      snapshot,
    ]);
  const exceptionsByVersion = new Map<string, typeof dashboard.exceptions>();
  for (const exception of dashboard.exceptions)
    exceptionsByVersion.set(exception.versionId, [
      ...(exceptionsByVersion.get(exception.versionId) ?? []),
      exception,
    ]);
  const exportsByVersion = new Map<string, typeof dashboard.exports>();
  for (const payrollExport of dashboard.exports)
    exportsByVersion.set(payrollExport.versionId, [
      ...(exportsByVersion.get(payrollExport.versionId) ?? []),
      payrollExport,
    ]);
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - 13);
  const date = (value: Date) => value.toISOString().slice(0, 10);

  const hoursByVersion = new Map<
    string,
    ReadonlyArray<{
      readonly staffId: string;
      readonly regularHours: number;
      readonly overtimeHours: number;
    }>
  >();
  for (const version of dashboard.versions) {
    const entries = (snapshotsByVersion.get(version.id) ?? []).map(
      (snapshot) =>
        snapshot.clockOutAt
          ? {
              staffId: snapshot.staffId,
              clockInAt: snapshot.clockInAt,
              clockOutAt: snapshot.clockOutAt,
            }
          : {
              staffId: snapshot.staffId,
              clockInAt: snapshot.clockInAt,
            },
    );
    hoursByVersion.set(version.id, summarizePeriodHours(entries));
  }
  const versionsByPeriod = new Map<string, PayrollPeriodVersionRecord[]>();
  for (const version of dashboard.versions) {
    const current = versionsByPeriod.get(version.periodId) ?? [];
    current.push(version);
    versionsByPeriod.set(version.periodId, current);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Payroll
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Approve staff time, preserve versioned corrections, and hand off
          checksummed earning-code hours. This workspace contains staff time
          only.
        </p>
      </div>
      <Card>
        <h2 className="text-sm font-medium">Open a pay period</h2>
        <OpenPayrollPeriodForm
          defaultStart={date(start)}
          defaultEnd={date(today)}
        />
      </Card>
      {dashboard.periods.length === 0 ? (
        <Card>
          <p
            id="payroll-empty"
            className="text-sm text-[var(--color-stone-500)]"
          >
            No payroll periods have been opened.
          </p>
        </Card>
      ) : (
        <div id="payroll-periods" className="flex flex-col gap-4">
          {dashboard.periods.map((period) => {
            const current = period.currentVersionId
              ? versions.get(period.currentVersionId)
              : undefined;
            const exceptions = current
              ? (exceptionsByVersion.get(current.id) ?? [])
              : [];
            const snapshots = current
              ? (snapshotsByVersion.get(current.id) ?? [])
              : [];
            const payrollExports = current
              ? (exportsByVersion.get(current.id) ?? [])
              : [];
            const openExceptions = exceptions.filter(
              (exception) => !exception.resolvedAt,
            );
            const hours = current ? (hoursByVersion.get(current.id) ?? []) : [];
            const chronological = [...(versionsByPeriod.get(period.id) ?? [])]
              .sort((a, b) => a.versionNumber - b.versionNumber)
              .map((version) => ({
                version,
                snapshots: snapshotsByVersion.get(version.id) ?? [],
              }));
            return (
              <Card key={period.id} data-period-id={period.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-medium">
                    {period.periodStart} — {period.periodEnd}
                  </h2>
                  {current ? (
                    <Badge
                      tone={
                        current.state === "approved" ? "success" : "neutral"
                      }
                    >
                      Version {current.versionNumber} · {current.state}
                    </Badge>
                  ) : null}
                </div>
                {current ? (
                  <>
                    <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                      Prepared by{" "}
                      {staffName.get(current.preparedByStaffId) ?? "a manager"}
                      {current.approvedAt
                        ? ` · approved ${new Date(current.approvedAt).toLocaleString()}`
                        : ""}
                    </p>
                    <section className="mt-4">
                      <h3 className="text-sm font-medium">
                        Earning-code hours
                      </h3>
                      {hours.length === 0 ? (
                        <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                          No staff hours available for the current version.
                        </p>
                      ) : (
                        <table
                          id={`hours-${period.id}`}
                          className="mt-2 w-full max-w-xl border-collapse text-sm"
                        >
                          <thead>
                            <tr className="text-left text-[var(--color-stone-500)]">
                              <th className="border-b border-[var(--color-stone-200)] py-1 pr-3 font-medium">
                                Staff
                              </th>
                              <th className="border-b border-[var(--color-stone-200)] py-1 pr-3 font-medium">
                                Regular
                              </th>
                              <th className="border-b border-[var(--color-stone-200)] py-1 font-medium">
                                Overtime
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {hours.map((row) => (
                              <tr key={row.staffId}>
                                <td className="border-b border-[var(--color-stone-100)] py-1 pr-3">
                                  {staffName.get(row.staffId) ?? "Staff member"}
                                </td>
                                <td className="border-b border-[var(--color-stone-100)] py-1 pr-3">
                                  {row.regularHours}
                                </td>
                                <td className="border-b border-[var(--color-stone-100)] py-1">
                                  {row.overtimeHours}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </section>
                    <section className="mt-4">
                      <h3 className="text-sm font-medium">Exceptions</h3>
                      {exceptions.length === 0 ? (
                        <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                          No payroll exceptions.
                        </p>
                      ) : (
                        <ul className="mt-2 flex flex-col gap-2">
                          {exceptions.map((exception) => (
                            <li
                              key={exception.id}
                              className="rounded border border-[var(--color-stone-100)] p-3 text-sm"
                            >
                              <strong>
                                {exception.kind.replaceAll("_", " ")}
                              </strong>{" "}
                              · {exception.detail}{" "}
                              {exception.resolvedAt ? (
                                <Badge tone="success">resolved</Badge>
                              ) : (
                                <>
                                  <Badge tone="warning">open</Badge>
                                  <ResolvePayrollExceptionForm
                                    exceptionId={exception.id}
                                    kind={exception.kind}
                                  />
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                    {chronological.length > 1 ? (
                      <section className="mt-4">
                        <h3 className="text-sm font-medium">Version history</h3>
                        <ul className="mt-2 flex flex-col gap-2 text-sm">
                          {chronological.map(
                            ({ version, snapshots: versionSnapshots }) => (
                              <li
                                key={version.id}
                                className="rounded border border-[var(--color-stone-100)] p-3"
                              >
                                <span className="font-medium">
                                  Version {version.versionNumber} ·{" "}
                                  {version.state}
                                </span>
                                <span className="text-[var(--color-stone-500)]">
                                  {" "}
                                  · {versionSnapshots.length} captured entry
                                  {versionSnapshots.length === 1 ? "" : "s"}
                                  {version.predecessorVersionId
                                    ? " · correction of the previous version"
                                    : " · original"}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      </section>
                    ) : null}
                    {current.state === "draft" ? (
                      <section className="mt-4">
                        <h3 className="text-sm font-medium">
                          Correct an entry
                        </h3>
                        {snapshots.length === 0 ? (
                          <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                            No clock entries were captured for this period.
                          </p>
                        ) : (
                          snapshots.map((snapshot) => (
                            <div
                              key={snapshot.id}
                              className="mt-2 rounded border border-[var(--color-stone-100)] p-3"
                            >
                              <p className="text-sm">
                                {staffName.get(snapshot.staffId) ??
                                  "Staff member"}{" "}
                                ·{" "}
                                {new Date(snapshot.clockInAt).toLocaleString()}{" "}
                                —{" "}
                                {snapshot.clockOutAt
                                  ? new Date(
                                      snapshot.clockOutAt,
                                    ).toLocaleString()
                                  : "open"}
                              </p>
                              <CorrectPayrollEntryForm
                                periodId={period.id}
                                sourceTimeEntryId={snapshot.sourceTimeEntryId}
                                clockInAt={snapshot.clockInAt}
                                clockOutAt={snapshot.clockOutAt}
                              />
                            </div>
                          ))
                        )}
                      </section>
                    ) : null}
                    {current.state === "draft" ? (
                      <section className="mt-4">
                        <h3 className="text-sm font-medium">
                          Independent approval
                        </h3>
                        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                          A different manager must approve, and{" "}
                          {openExceptions.length} open exception
                          {openExceptions.length === 1 ? "" : "s"} remain.
                        </p>
                        <ApprovePayrollPeriodForm periodId={period.id} />
                      </section>
                    ) : (
                      <section className="mt-4">
                        <h3 className="text-sm font-medium">
                          Provider-neutral export
                        </h3>
                        {payrollExports.map((payrollExport) => (
                          <div key={payrollExport.id} className="mt-2 text-sm">
                            <p>
                              Recorded export · {payrollExport.rowCount}{" "}
                              earning-code rows · checksum{" "}
                              <code>{payrollExport.checksum}</code>
                            </p>
                            <p className="mt-1 flex flex-wrap gap-3">
                              <a
                                className="underline"
                                href={`/staff/payroll/exports/${payrollExport.id}/csv`}
                              >
                                Download CSV
                              </a>
                              <a
                                className="underline"
                                href={`/staff/payroll/exports/${payrollExport.id}/json`}
                              >
                                Download JSON
                              </a>
                            </p>
                          </div>
                        ))}
                        <RecordPayrollExportForm versionId={current.id} />
                      </section>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-[var(--color-danger-500)]">
                    Current payroll version could not be read.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
