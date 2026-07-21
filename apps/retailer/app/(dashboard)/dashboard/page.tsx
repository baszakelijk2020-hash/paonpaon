import {
  AlterationWorkflowRepository,
  AppointmentRepository,
  CustomerRepository,
  NotificationRepository,
  RetailerRepository,
  RetailerStaffRepository,
  StaffRosterRepository,
} from "@paon/database";
import { retailerRoleHasAlterationsPermission } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RetailerStatusBadge } from "../status-badge";

import { ClockWidget } from "./clock-widget";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function isToday(isoDate: string): boolean {
  const target = new Date(isoDate);
  const now = new Date();
  return (
    target.getUTCFullYear() === now.getUTCFullYear() &&
    target.getUTCMonth() === now.getUTCMonth() &&
    target.getUTCDate() === now.getUTCDate()
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  if (["workshop_manager", "worker"].includes(session.retailerRole)) {
    redirect("/alterations");
  }
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findById(
    session.retailerId,
  );
  if (!retailer) {
    notFound();
  }

  const staff = await new RetailerStaffRepository(supabase).findByRetailer(
    session.retailerId,
  );
  const activeStaffCount = staff.filter((member) => member.acceptedAt).length;

  const myStaffRow = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  const openEntry = myStaffRow
    ? await new StaffRosterRepository(supabase).findOpenTimeEntry(myStaffRow.id)
    : null;

  const canApprovePrice = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "approve_pricing",
  );

  const [pendingProposals, appointments, notifications] = await Promise.all([
    canApprovePrice
      ? new AlterationWorkflowRepository(
          supabase,
        ).findPendingProposalsByRetailer(session.retailerId)
      : Promise.resolve([]),
    new AppointmentRepository(supabase).findByRetailer(session.retailerId),
    new NotificationRepository(supabase).findByUser(session.userId),
  ]);

  const todaysAppointments = appointments.filter(
    (appointment) =>
      isToday(appointment.startsAt) &&
      !["completed", "canceled", "no_show"].includes(appointment.status),
  );
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const customerRepo = new CustomerRepository(supabase);
  const appointmentCustomers = await Promise.all(
    todaysAppointments.map((appointment) =>
      customerRepo.findById(appointment.customerId),
    ),
  );

  const hasAttentionItems =
    pendingProposals.length > 0 ||
    todaysAppointments.length > 0 ||
    unreadCount > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
            {retailer.displayName}
          </h1>
          <RetailerStatusBadge status={retailer.status} />
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          {retailer.legalName} · {retailer.defaultCurrency} ·{" "}
          {retailer.defaultLocale}
        </p>
      </div>

      {myStaffRow ? (
        <ClockWidget
          {...(openEntry ? { clockedInAt: openEntry.clockInAt } : {})}
        />
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Needs your attention
        </h2>
        {hasAttentionItems ? (
          <div className="flex flex-col gap-3">
            {pendingProposals.map((proposal) => (
              <Link
                key={proposal.id}
                href={`/alterations/${proposal.alterationId}#pricing`}
                className="block"
              >
                <Card className="flex items-center justify-between gap-3 border-l-4 border-l-[var(--color-warning-500)] shadow-[var(--shadow-elevated)]">
                  <div>
                    <p className="font-medium text-[var(--color-stone-900)]">
                      Price approval needed · {proposal.workOrderNumber}
                    </p>
                    <p className="text-sm text-[var(--color-stone-500)]">
                      {formatMoney(proposal.originalAmount, "en-US")} →{" "}
                      {formatMoney(proposal.proposedAmount, "en-US")}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-[var(--color-stone-700)]">
                    Review →
                  </span>
                </Card>
              </Link>
            ))}
            {todaysAppointments.map((appointment, index) => (
              <Link
                key={appointment.id}
                href={`/appointments/${appointment.id}`}
                className="block"
              >
                <Card className="flex items-center justify-between gap-3 shadow-[var(--shadow-elevated)]">
                  <div>
                    <p className="font-medium text-[var(--color-stone-900)]">
                      Today,{" "}
                      {new Date(appointment.startsAt).toLocaleTimeString(
                        "en-US",
                        { hour: "2-digit", minute: "2-digit" },
                      )}{" "}
                      · {appointment.type.replaceAll("_", " ")}
                    </p>
                    <p className="text-sm text-[var(--color-stone-500)]">
                      {appointmentCustomers[index]?.fullName ?? "Customer"}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-[var(--color-stone-700)]">
                    View →
                  </span>
                </Card>
              </Link>
            ))}
            {unreadCount > 0 ? (
              <Link href="/messages" className="block">
                <Card className="flex items-center justify-between gap-3 shadow-[var(--shadow-elevated)]">
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {unreadCount} unread message{unreadCount === 1 ? "" : "s"}
                  </p>
                  <span className="text-sm font-medium text-[var(--color-stone-700)]">
                    Open inbox →
                  </span>
                </Card>
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-10 text-center">
            <p className="text-[var(--color-stone-600)]">
              Nothing needs you right now — no pending approvals, no
              appointments today, no unread messages.
            </p>
          </div>
        )}
      </div>

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Tier
          </p>
          <p className="capitalize text-[var(--color-stone-900)]">
            {retailer.tier}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Team
          </p>
          <p className="text-[var(--color-stone-900)]">
            {activeStaffCount} active · {staff.length} total
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Onboarded
          </p>
          <p className="text-[var(--color-stone-900)]">
            {formatDate(retailer.createdAt, "en-US")}
          </p>
        </div>
      </Card>
    </div>
  );
}
