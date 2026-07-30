import {
  AppointmentRepository,
  BranchCalendarRepository,
  CustomerRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  findBranchCoverageGaps,
  formatInstantInBranchTimezone,
  retailerRoleAtLeast,
} from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BranchCalendarEntryForm } from "./branch-calendar-entry-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function BranchCalendarPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const repo = new BranchCalendarRepository(supabase);
  const branches = await repo.listBranches(session.retailerId);

  if (branches.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Branch calendar
        </h1>
        <Card className="px-6 py-12 text-center">
          <p className="text-[var(--color-stone-600)]">
            Add a branch with timezone before using the shared calendar.
          </p>
          {retailerRoleAtLeast(session.retailerRole, "manager") ? (
            <Link
              href="/settings/branches"
              className={buttonVariants({ className: "mt-6" })}
            >
              Manage branches
            </Link>
          ) : null}
        </Card>
      </div>
    );
  }

  const primaryBranch =
    branches.find((branch) => branch.isPrimary) ?? branches[0];
  if (!primaryBranch) {
    redirect("/settings/branches");
  }

  const queryDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: primaryBranch.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [entries, staff, customers, appointments] = await Promise.all([
    repo.listEntriesForBranch({
      branchId: primaryBranch.id,
      localDate: queryDate,
      timezone: primaryBranch.timezone,
    }),
    new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
    new AppointmentRepository(supabase).findByRetailer(session.retailerId),
  ]);

  const coverageGaps = findBranchCoverageGaps({
    branchId: primaryBranch.id,
    entries,
  });

  const customerNameById = Object.fromEntries(
    customers.map((customer) => [customer.id, customer.fullName]),
  );

  const branchAppointments = appointments.filter(
    (appointment) =>
      appointment.branchId === primaryBranch.id ||
      (!appointment.branchId &&
        appointment.startsAt.slice(0, 10) === queryDate),
  );

  const canManage = retailerRoleAtLeast(session.retailerRole, "manager");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            Branch calendar
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            {primaryBranch.name} · {primaryBranch.timezone} ·{" "}
            {formatDate(queryDate, "en-US")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/appointments"
            className={buttonVariants({ variant: "ghost" })}
          >
            Appointments list
          </Link>
          {canManage ? (
            <Link
              href="/settings/branches"
              className={buttonVariants({ variant: "secondary" })}
            >
              Branches
            </Link>
          ) : null}
        </div>
      </div>

      {coverageGaps.length > 0 ? (
        <Card className="border-[var(--color-warning-200)] bg-[var(--color-warning-50)]">
          <p className="text-sm font-medium text-[var(--color-stone-900)]">
            Coverage gap
          </p>
          <p className="mt-1 text-sm text-[var(--color-stone-600)]">
            {coverageGaps[0]?.title} has no assigned advisor.
          </p>
        </Card>
      ) : null}

      {canManage ? (
        <BranchCalendarEntryForm
          branchId={primaryBranch.id}
          staffOptions={staff.map((member) => ({
            id: member.id,
            name: member.fullName,
          }))}
          customerOptions={customers.slice(0, 50).map((customer) => ({
            id: customer.id,
            name: customer.fullName,
          }))}
        />
      ) : null}

      <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0">
        <div className="px-6 py-4">
          <h2 className="font-medium text-[var(--color-stone-900)]">
            Calendar entries
          </h2>
        </div>
        {entries.length === 0 ? (
          <p className="px-6 py-8 text-sm text-[var(--color-stone-500)]">
            No entries scheduled for this branch day.
          </p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="px-6 py-4">
              <p className="font-medium text-[var(--color-stone-900)]">
                {entry.title}
              </p>
              <p className="text-sm text-[var(--color-stone-500)]">
                {entry.entryType.replaceAll("_", " ")} ·{" "}
                {formatInstantInBranchTimezone({
                  instant: entry.startsAt,
                  timezone: primaryBranch.timezone,
                })}{" "}
                –{" "}
                {formatInstantInBranchTimezone({
                  instant: entry.endsAt,
                  timezone: primaryBranch.timezone,
                })}
                {entry.customerId
                  ? ` · ${customerNameById[entry.customerId] ?? "Customer"}`
                  : ""}
              </p>
            </div>
          ))
        )}
      </Card>

      <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0">
        <div className="px-6 py-4">
          <h2 className="font-medium text-[var(--color-stone-900)]">
            Appointments today
          </h2>
        </div>
        {branchAppointments.length === 0 ? (
          <p className="px-6 py-8 text-sm text-[var(--color-stone-500)]">
            No appointments on this branch day.
          </p>
        ) : (
          branchAppointments.map((appointment) => (
            <Link
              key={appointment.id}
              href={`/appointments/${appointment.id}`}
              className="block px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <p className="font-medium text-[var(--color-stone-900)]">
                {customerNameById[appointment.customerId] ?? "Customer"} ·{" "}
                {appointment.status.replaceAll("_", " ")}
              </p>
              <p className="text-sm text-[var(--color-stone-500)]">
                {formatInstantInBranchTimezone({
                  instant: appointment.startsAt,
                  timezone: primaryBranch.timezone,
                })}
              </p>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
