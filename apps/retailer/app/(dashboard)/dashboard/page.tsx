import {
  AlterationRepository,
  AlterationWorkflowRepository,
  AppointmentRepository,
  CustomerRepository,
  NotificationRepository,
  OrderRepository,
  RetailerRepository,
  RetailerStaffRepository,
  StaffRosterRepository,
} from "@paon/database";
import {
  retailerRoleHasAlterationsPermission,
  type RetailerRole,
} from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RetailerStatusBadge } from "../status-badge";

import { ClockWidget } from "./clock-widget";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const CLOSED_ORDER_STATUSES = new Set([
  "delivered",
  "completed",
  "canceled",
  "refunded",
]);
const CLOSED_ALTERATION_STATUSES = new Set(["completed", "canceled"]);

const ROLE_BRIEFS: Record<
  RetailerRole,
  { eyebrow: string; title: string; description: string }
> = {
  owner: {
    eyebrow: "Owner brief",
    title: "The atelier, at a glance.",
    description:
      "Commercial promises, client moments and decisions that need your hand.",
  },
  admin: {
    eyebrow: "Administrator brief",
    title: "Keep the house moving.",
    description:
      "People, client commitments and operational exceptions in one calm view.",
  },
  manager: {
    eyebrow: "Manager brief",
    title: "Today on the floor.",
    description:
      "Appointments, fulfilment and fitting-room work that shape the day.",
  },
  sales_associate: {
    eyebrow: "Advisor brief",
    title: "Make every client moment count.",
    description:
      "Your next conversations, appointments and relationship signals.",
  },
  production_staff: {
    eyebrow: "Operations brief",
    title: "Promises in motion.",
    description:
      "Orders and garments that need to advance before the next handoff.",
  },
  workshop_manager: {
    eyebrow: "Workshop brief",
    title: "The workroom, in motion.",
    description: "Assignments, due dates and quality decisions.",
  },
  worker: {
    eyebrow: "Workroom brief",
    title: "Your bench, clearly.",
    description: "Assigned garments and the next action for each.",
  },
  read_only: {
    eyebrow: "Atelier brief",
    title: "A clear view of today.",
    description: "Current activity and client commitments.",
  },
};

function isToday(isoDate: string): boolean {
  const target = new Date(isoDate);
  const now = new Date();
  return (
    target.getUTCFullYear() === now.getUTCFullYear() &&
    target.getUTCMonth() === now.getUTCMonth() &&
    target.getUTCDate() === now.getUTCDate()
  );
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
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
  if (!retailer) notFound();

  const canApprovePrice = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "approve_pricing",
  );
  const [
    staff,
    myStaffRow,
    pendingProposals,
    appointments,
    notifications,
    orders,
    alterations,
  ] = await Promise.all([
    new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
    new RetailerStaffRepository(supabase).findByUserId(session.userId),
    canApprovePrice
      ? new AlterationWorkflowRepository(
          supabase,
        ).findPendingProposalsByRetailer(session.retailerId)
      : Promise.resolve([]),
    new AppointmentRepository(supabase).findByRetailer(session.retailerId),
    new NotificationRepository(supabase).findByUser(session.userId),
    new OrderRepository(supabase).findByRetailer(session.retailerId),
    new AlterationRepository(supabase).findByRetailer(session.retailerId),
  ]);

  const openEntry = myStaffRow
    ? await new StaffRosterRepository(supabase).findOpenTimeEntry(myStaffRow.id)
    : null;
  const todaysAppointments = appointments
    .filter(
      (appointment) =>
        isToday(appointment.startsAt) &&
        !["completed", "canceled", "no_show"].includes(appointment.status),
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const activeOrders = orders.filter(
    (order) => !CLOSED_ORDER_STATUSES.has(order.status),
  );
  const openAlterations = alterations.filter(
    (alteration) => !CLOSED_ALTERATION_STATUSES.has(alteration.status),
  );
  const activeStaffCount = staff.filter((member) => member.acceptedAt).length;
  const brief = ROLE_BRIEFS[session.retailerRole];

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
    <div className="flex flex-col gap-8">
      <section className="relative isolate overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-stone-900)] px-6 py-8 text-white shadow-[var(--shadow-elevated)] sm:px-10 sm:py-11">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 -z-10 w-2/5 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),transparent_68%)]"
        />
        <div className="flex max-w-3xl flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-[var(--font-accent)] uppercase tracking-[0.22em] text-white/60">
              {brief.eyebrow}
            </p>
            <RetailerStatusBadge status={retailer.status} />
          </div>
          <div>
            <h1 className="max-w-2xl text-4xl font-[var(--font-display)] leading-[0.98] sm:text-6xl">
              {brief.title}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
              {brief.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={
                session.retailerRole === "production_staff"
                  ? "/orders"
                  : "/appointments"
              }
              className={buttonVariants({
                variant: "secondary",
                size: "lg",
              })}
            >
              {session.retailerRole === "production_staff"
                ? "Open production queue"
                : "Open today’s diary"}
            </Link>
            {session.retailerRole !== "production_staff" ? (
              <Link
                href="/customers"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "border-white/30 text-white hover:bg-white/10",
                })}
              >
                Find a client
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section
        aria-label="Today at a glance"
        className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-stone-200)] bg-white shadow-[var(--shadow-lifted)] lg:grid-cols-4"
      >
        {[
          {
            value: todaysAppointments.length,
            label: "Client moments today",
            href: "/appointments",
          },
          {
            value: activeOrders.length,
            label: "Orders in motion",
            href: "/orders",
          },
          {
            value: openAlterations.length,
            label: "Open garments",
            href: "/alterations",
          },
          {
            value: unreadCount,
            label: "Unread updates",
            href: "/notifications",
          },
        ].map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="group border-b border-r border-[var(--color-stone-200)] px-5 py-5 last:border-r-0 sm:px-6"
          >
            <p className="text-4xl font-[var(--font-display)] text-[var(--color-stone-900)]">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-[var(--color-stone-500)] group-hover:text-[var(--color-stone-900)]">
              {metric.label} →
            </p>
          </Link>
        ))}
      </section>

      {myStaffRow ? (
        <ClockWidget
          {...(openEntry ? { clockedInAt: openEntry.clockInAt } : {})}
        />
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-[var(--font-accent)] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
                Now
              </p>
              <h2 className="text-3xl font-[var(--font-display)] text-[var(--color-stone-900)]">
                Needs your attention
              </h2>
            </div>
            <span className="rounded-full bg-[var(--color-stone-900)] px-3 py-1 text-xs text-white">
              {pendingProposals.length +
                todaysAppointments.length +
                unreadCount}
            </span>
          </div>
          {hasAttentionItems ? (
            <div className="flex flex-col gap-3">
              {pendingProposals.map((proposal) => (
                <Link
                  key={proposal.id}
                  href={`/alterations/${proposal.alterationId}#pricing`}
                  className="group"
                >
                  <Card className="flex items-center justify-between gap-4 border-l-4 border-l-[var(--color-warning-500)] transition-transform duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lifted)]">
                    <div>
                      <p className="font-medium text-[var(--color-stone-900)]">
                        Price approval needed · {proposal.workOrderNumber}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                        {formatMoney(proposal.originalAmount, "en-US")} →{" "}
                        {formatMoney(proposal.proposedAmount, "en-US")}
                      </p>
                    </div>
                    <span aria-hidden="true" className="text-xl">
                      ↗
                    </span>
                  </Card>
                </Link>
              ))}
              {todaysAppointments.map((appointment, index) => (
                <Link
                  key={appointment.id}
                  href={`/appointments/${appointment.id}`}
                  className="group"
                >
                  <Card className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-4 transition-transform duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lifted)]">
                    <p className="text-2xl font-[var(--font-display)]">
                      {formatTime(appointment.startsAt)}
                    </p>
                    <div>
                      <p className="font-medium">
                        {appointmentCustomers[index]?.fullName ?? "Customer"}
                      </p>
                      <p className="text-sm capitalize text-[var(--color-stone-500)]">
                        {appointment.type.replaceAll("_", " ")}
                      </p>
                    </div>
                    <span aria-hidden="true">→</span>
                  </Card>
                </Link>
              ))}
              {unreadCount > 0 ? (
                <Link href="/messages" className="group">
                  <Card className="flex items-center justify-between gap-3 transition-transform duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lifted)]">
                    <div>
                      <p className="font-medium">
                        {unreadCount} conversation
                        {unreadCount === 1 ? "" : "s"} waiting
                      </p>
                      <p className="text-sm text-[var(--color-stone-500)]">
                        Reply while the client’s context is fresh.
                      </p>
                    </div>
                    <span aria-hidden="true">→</span>
                  </Card>
                </Link>
              ) : null}
            </div>
          ) : (
            <Card className="border-dashed py-12 text-center">
              <p className="text-2xl font-[var(--font-display)]">
                The atelier is in rhythm.
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-stone-500)]">
                There are no approvals, appointments or unread messages waiting.
                Use the quiet moment to prepare a client follow-up.
              </p>
              <Link
                href="/customers"
                className={buttonVariants({
                  variant: "outline",
                  className: "mt-5",
                })}
              >
                Open client book
              </Link>
            </Card>
          )}
        </section>

        <aside>
          <p className="text-[11px] font-[var(--font-accent)] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            House pulse
          </p>
          <h2 className="text-3xl font-[var(--font-display)]">This atelier</h2>
          <Card className="mt-4 overflow-hidden p-0">
            <div className="border-b border-[var(--color-stone-100)] px-6 py-5">
              <p className="text-2xl font-[var(--font-display)]">
                {retailer.displayName}
              </p>
              <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                {retailer.legalName}
              </p>
            </div>
            <dl className="grid grid-cols-2">
              <div className="border-b border-r border-[var(--color-stone-100)] p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">Team</dt>
                <dd className="mt-1 text-lg">{activeStaffCount} active</dd>
              </div>
              <div className="border-b border-[var(--color-stone-100)] p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Membership
                </dt>
                <dd className="mt-1 text-lg capitalize">{retailer.tier}</dd>
              </div>
              <div className="border-r border-[var(--color-stone-100)] p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Currency
                </dt>
                <dd className="mt-1 text-lg">{retailer.defaultCurrency}</dd>
              </div>
              <div className="p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Locale
                </dt>
                <dd className="mt-1 text-lg">{retailer.defaultLocale}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
