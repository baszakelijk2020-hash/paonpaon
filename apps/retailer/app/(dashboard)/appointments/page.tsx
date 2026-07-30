import {
  AppointmentRepository,
  CustomerMomentRepository,
  CustomerRepository,
  RetailerBranchRepository,
} from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";

import { AppointmentsList } from "./appointments-list";
import { ensureDefaultBranchAction } from "./branch-actions";

import {
  appointmentStatusLabelsForPreset,
  loadRetailerFamiliarityPresetKey,
} from "@/lib/familiarity-preset";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const session = await requireSession();
  const { branch: branchFilter } = await searchParams;
  const supabase = await getSupabaseServerClient();
  const branchRepo = new RetailerBranchRepository(supabase);

  let branches = await branchRepo.listByRetailer(session.retailerId);
  if (
    branches.length === 0 &&
    retailerRoleAtLeast(session.retailerRole, "manager")
  ) {
    await branchRepo.ensureDefaultBranch({
      retailerId: session.retailerId,
      timezone: "Europe/Amsterdam",
    });
    branches = await branchRepo.listByRetailer(session.retailerId);
  }

  const [appointments, customers, moments, presetKey] = await Promise.all([
    new AppointmentRepository(supabase).findByRetailer(session.retailerId),
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
    new CustomerMomentRepository(supabase).listByRetailer(
      session.retailerId,
      12,
    ),
    loadRetailerFamiliarityPresetKey(session.retailerId),
  ]);
  const statusLabels = appointmentStatusLabelsForPreset(presetKey);

  const filtered =
    branchFilter && branchFilter !== "all"
      ? appointments.filter(
          (appointment) => appointment.branchId === branchFilter,
        )
      : appointments;

  const customerNameById = Object.fromEntries(
    customers.map((customer) => [customer.id, customer.fullName]),
  );
  const branchNameById = Object.fromEntries(
    branches.map((branch) => [
      branch.id,
      `${branch.name} (${branch.timezone})`,
    ]),
  );
  const canManageBranches = retailerRoleAtLeast(
    session.retailerRole,
    "manager",
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            Appointments
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            Shared house calendar · {filtered.length} appointment
            {filtered.length === 1 ? "" : "s"} ·{" "}
            <Link href="/appointments/availability" className="underline">
              Availability
            </Link>
          </p>
        </div>
        <Link href="/appointments/new" className={buttonVariants()}>
          New appointment
        </Link>
      </div>

      {branches.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/appointments"
            className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs ${
              !branchFilter || branchFilter === "all"
                ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-white"
                : "border-[var(--color-stone-300)]"
            }`}
          >
            All branches
          </Link>
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={`/appointments?branch=${branch.id}`}
              className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs ${
                branchFilter === branch.id
                  ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-white"
                  : "border-[var(--color-stone-300)]"
              }`}
            >
              {branch.name}
              {branch.isDefault ? " · default" : ""}
            </Link>
          ))}
        </div>
      ) : canManageBranches ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-600)]">
            No branches yet. Create the default house branch to attach timezone
            and coverage filters.
          </p>
          <form action={ensureDefaultBranchAction} className="mt-3">
            <button type="submit" className={buttonVariants({ size: "sm" })}>
              Create default branch (Europe/Amsterdam)
            </button>
          </form>
        </Card>
      ) : null}

      {moments.length > 0 ? (
        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Upcoming customer moments
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-[var(--color-stone-700)]">
            {moments.map((moment) => (
              <li key={moment.id}>
                <Link
                  href={`/customers/${moment.customerId}`}
                  className="underline-offset-2 hover:underline"
                >
                  {moment.occursOn} · {moment.label}
                </Link>
                {moment.recurrence !== "none" ? ` · ${moment.recurrence}` : ""}
                {moment.branchId && branchNameById[moment.branchId]
                  ? ` · ${branchNameById[moment.branchId]}`
                  : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {filtered.length === 0 ? (
        <div className="paon-reveal rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">No appointments yet.</p>
          <Link
            href="/appointments/new"
            className={buttonVariants({ className: "mt-6" })}
          >
            New appointment
          </Link>
        </div>
      ) : (
        <AppointmentsList
          appointments={filtered}
          customerNameById={customerNameById}
          statusLabels={statusLabels}
        />
      )}
    </div>
  );
}
