import {
  AlterationWorkflowRepository,
  AppointmentRepository,
  ClientelingOpportunityRepository,
  CustomerRepository,
  NotificationRepository,
  ProductVariantRepository,
} from "@paon/database";
import {
  APPOINTMENT_TYPE_LABELS,
  retailerRoleAtLeast,
  retailerRoleHasAlterationsPermission,
  type Appointment,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";
import Link from "next/link";

import {
  acceptOpportunity,
  dismissOpportunity,
  snoozeOpportunity,
} from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;

const STATUS_TONE: Record<
  Appointment["status"],
  "neutral" | "success" | "warning" | "danger"
> = {
  requested: "warning",
  confirmed: "success",
  checked_in: "success",
  completed: "neutral",
  canceled: "danger",
  no_show: "danger",
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

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:00 ${period}`;
}

export default async function MissionControlPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const canApprovePrice = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "approve_pricing",
  );
  const [
    appointments,
    customers,
    draftOpportunities,
    pendingProposals,
    notifications,
    lowStockCount,
  ] = await Promise.all([
    new AppointmentRepository(supabase).findByRetailer(session.retailerId),
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
    retailerRoleAtLeast(session.retailerRole, "sales_associate")
      ? new ClientelingOpportunityRepository(supabase).listDraftInbox(
          session.retailerId,
          30,
        )
      : Promise.resolve([]),
    // PHASE 17.2: the same three sources /dashboard's own "Needs your
    // attention" brief already aggregates — reused here verbatim (same
    // repository calls, same role gates), not a second query path.
    canApprovePrice
      ? new AlterationWorkflowRepository(
          supabase,
        ).findPendingProposalsByRetailer(session.retailerId)
      : Promise.resolve([]),
    new NotificationRepository(supabase).findByUser(session.userId),
    retailerRoleAtLeast(session.retailerRole, "manager")
      ? new ProductVariantRepository(supabase).countLowStockForRetailer(
          session.retailerId,
          5,
        )
      : Promise.resolve(0),
  ]);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  const nameByCustomerId = new Map(
    customers.map((customer) => [customer.id, customer.fullName]),
  );

  const todaysAppointments = appointments
    .filter(
      (appointment) =>
        isToday(appointment.startsAt) && appointment.status !== "canceled",
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const appointmentsByHour = new Map<number, Appointment[]>();
  for (const appointment of todaysAppointments) {
    const hour = new Date(appointment.startsAt).getHours();
    const list = appointmentsByHour.get(hour) ?? [];
    list.push(appointment);
    appointmentsByHour.set(hour, list);
  }

  const hours = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR },
    (_, index) => DAY_START_HOUR + index,
  );

  const todaysOpportunities = draftOpportunities.filter(
    (opportunity) => !opportunity.dueAt || isToday(opportunity.dueAt),
  );

  const hasAttentionItems =
    pendingProposals.length > 0 || unreadCount > 0 || lowStockCount > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Mission Control
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Today&rsquo;s appointments, time-blocked, next to the clienteling
          picks worth acting on before end of day.
        </p>
      </div>

      {hasAttentionItems ? (
        <Card id="mission-control-attention" className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Needs your attention
          </h2>
          <div className="flex flex-col gap-3">
            {pendingProposals.map((proposal) => (
              <Link
                key={proposal.id}
                href={`/alterations/${proposal.alterationId}#pricing`}
                className="group"
              >
                <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-l-4 border-[var(--color-stone-200)] border-l-[var(--color-warning-500)] p-3 group-hover:bg-[var(--color-stone-50)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-stone-900)]">
                      Price approval needed · {proposal.workOrderNumber}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                      {formatMoney(proposal.originalAmount, "en-US")} →{" "}
                      {formatMoney(proposal.proposedAmount, "en-US")}
                    </p>
                  </div>
                  <span aria-hidden="true">→</span>
                </div>
              </Link>
            ))}
            {unreadCount > 0 ? (
              <Link href="/messages" className="group">
                <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 group-hover:bg-[var(--color-stone-50)]">
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {unreadCount === 1
                      ? "1 conversation waiting"
                      : `${unreadCount} conversations waiting`}
                  </p>
                  <span aria-hidden="true">→</span>
                </div>
              </Link>
            ) : null}
            {lowStockCount > 0 ? (
              <Link href="/products" className="group">
                <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-l-4 border-[var(--color-stone-200)] border-l-[var(--color-warning-500)] p-3 group-hover:bg-[var(--color-stone-50)]">
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {lowStockCount === 1
                      ? "1 variant at or below 5 units"
                      : `${lowStockCount} variants at or below 5 units`}
                  </p>
                  <span aria-hidden="true">→</span>
                </div>
              </Link>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <Card className="flex flex-col gap-0 divide-y divide-[var(--color-stone-100)] p-0">
          {hours.map((hour) => {
            const hourAppointments = appointmentsByHour.get(hour) ?? [];
            return (
              <div key={hour} className="flex gap-4 px-4 py-3">
                <div className="w-20 shrink-0 pt-1 text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
                  {formatHourLabel(hour)}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {hourAppointments.length === 0 ? (
                    <p className="text-sm text-[var(--color-stone-300)]">—</p>
                  ) : (
                    hourAppointments.map((appointment) => (
                      <Link
                        key={appointment.id}
                        href={`/appointments/${appointment.id}`}
                        data-appointment-id={appointment.id}
                        className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 hover:bg-[var(--color-stone-50)]"
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--color-stone-900)]">
                            {formatTime(appointment.startsAt)}–
                            {formatTime(appointment.endsAt)}{" "}
                            {nameByCustomerId.get(appointment.customerId) ??
                              "Client"}
                          </p>
                          <p className="text-xs text-[var(--color-stone-500)]">
                            {APPOINTMENT_TYPE_LABELS[appointment.type]}
                          </p>
                        </div>
                        <Badge tone={STATUS_TONE[appointment.status]}>
                          {appointment.status.replaceAll("_", " ")}
                        </Badge>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </Card>

        <Card className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              Priority tasks
            </h2>
            <p className="text-sm text-[var(--color-stone-500)]">
              Draft clienteling opportunities due today or with no deadline —
              accept, snooze, or dismiss.
            </p>
          </div>
          {todaysOpportunities.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              Nothing waiting.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {todaysOpportunities.map((opportunity) => (
                <li
                  key={opportunity.id}
                  className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3"
                >
                  <Link
                    href={`/customers/${opportunity.customerId}`}
                    className="block hover:underline"
                  >
                    <p className="text-sm font-medium text-[var(--color-stone-900)]">
                      {nameByCustomerId.get(opportunity.customerId) ?? "Client"}{" "}
                      · {opportunity.type.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-stone-600)]">
                      {opportunity.whyNow}
                    </p>
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <form action={acceptOpportunity.bind(null, opportunity.id)}>
                      <Button type="submit" size="sm">
                        Accept
                      </Button>
                    </form>
                    <form action={snoozeOpportunity.bind(null, opportunity.id)}>
                      <Button type="submit" size="sm" variant="secondary">
                        Snooze
                      </Button>
                    </form>
                    <form
                      action={dismissOpportunity.bind(null, opportunity.id)}
                    >
                      <Button type="submit" size="sm" variant="ghost">
                        Dismiss
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
