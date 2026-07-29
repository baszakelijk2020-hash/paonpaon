import {
  AppointmentRepository,
  ClientelingRepository,
  CustomerRepository,
  OrderRepository,
  PhysicalGarmentRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  asId,
  APPOINTMENT_TYPE_LABELS,
  retailerRoleAtLeast,
} from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LifecycleBadge } from "../../customers/lifecycle-badge";
import { AppointmentStatusBadge } from "../status-badge";

import { AppointmentActionsForm } from "./appointment-actions-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const appointment = await new AppointmentRepository(supabase).findById(
    asId<"AppointmentId">(id),
  );
  if (!appointment) {
    notFound();
  }

  const [customer, staff] = await Promise.all([
    new CustomerRepository(supabase).findById(appointment.customerId),
    new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
  ]);
  const [notes, orders, garments] = customer
    ? await Promise.all([
        new ClientelingRepository(supabase).findByCustomer(customer.id),
        new OrderRepository(supabase).findByCustomer(customer.id),
        new PhysicalGarmentRepository(supabase).findByCustomer(customer.id),
      ])
    : [[], [], []];
  const pinnedNote = notes.find((note) => note.pinned);
  const assignedAdvisor = staff.find(
    (member) => member.id === appointment.staffId,
  );

  const canManage = retailerRoleAtLeast(
    session.retailerRole,
    "sales_associate",
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="relative isolate overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-stone-900)] p-7 text-white shadow-[var(--shadow-elevated)] sm:p-10">
        <div
          aria-hidden="true"
          className="font-display absolute right-8 top-0 -z-10 text-[12rem] leading-none text-white/[0.035]"
        >
          {new Date(appointment.startsAt).getDate()}
        </div>
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-accent text-[11px] uppercase tracking-[0.22em] text-white/60">
                Appointment brief
              </p>
              <AppointmentStatusBadge status={appointment.status} />
            </div>
            <h1 className="font-display mt-4 text-3xl leading-none sm:text-4xl">
              {customer?.fullName ?? "Unknown customer"}
            </h1>
            <p className="mt-4 text-sm text-white/65">
              {APPOINTMENT_TYPE_LABELS[appointment.type]} ·{" "}
              {formatDate(appointment.startsAt, "en-US")} ·{" "}
              {new Date(appointment.startsAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
          {customer && canManage ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/customers/${customer.id}`}
                className={buttonVariants({
                  variant: "secondary",
                  size: "lg",
                })}
              >
                Open relationship
              </Link>
              <Link
                href={`/alterations/new?customerId=${customer.id}&appointmentId=${appointment.id}`}
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "border-white/30 text-white hover:bg-white/10",
                })}
              >
                Begin garment intake
              </Link>
              <Link
                href={`/appointments/${appointment.id}/print`}
                className={buttonVariants({
                  variant: "ghost",
                  size: "lg",
                  className: "text-white hover:bg-white/10",
                })}
              >
                Print
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="flex flex-col gap-6">
          <Card className="rounded-[var(--radius-md)]">
            <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
              Prepare the moment
            </p>
            <h2 className="font-display mt-3 text-3xl">
              What should the advisor know?
            </h2>
            {pinnedNote ? (
              <blockquote className="mt-5 border-l-2 border-[var(--color-stone-900)] pl-5 text-lg leading-7">
                {pinnedNote.body}
              </blockquote>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--color-stone-500)]">
                No team preference is pinned yet. Open the relationship after
                the appointment and save the detail worth remembering.
              </p>
            )}
            {appointment.notes ? (
              <div className="mt-6 rounded-[var(--radius-md)] bg-[var(--color-stone-50)] p-5">
                <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                  Appointment request
                </p>
                <p className="mt-2 text-sm leading-6">{appointment.notes}</p>
              </div>
            ) : null}
          </Card>

          {canManage ? (
            <Card className="rounded-[var(--radius-md)]">
              <div className="mb-5">
                <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
                  Run the appointment
                </p>
                <h2 className="font-display mt-2 text-3xl">
                  Ownership and progress
                </h2>
              </div>
              <AppointmentActionsForm
                appointmentId={appointment.id}
                currentStatus={appointment.status}
                {...(appointment.staffId
                  ? { currentStaffId: appointment.staffId }
                  : {})}
                staff={staff}
              />
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          <Card className="rounded-[var(--radius-md)] p-0">
            <div className="border-b border-[var(--color-stone-100)] p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-3xl">
                    {customer?.fullName ?? "Customer unavailable"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                    {customer?.email ?? "No email on file"}
                  </p>
                </div>
                {customer ? (
                  <LifecycleBadge stage={customer.lifecycleStage} />
                ) : null}
              </div>
            </div>
            <dl className="grid grid-cols-2">
              <div className="border-b border-r border-[var(--color-stone-100)] p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Advisor
                </dt>
                <dd className="mt-1 text-sm">
                  {assignedAdvisor?.fullName ?? "Unassigned"}
                </dd>
              </div>
              <div className="border-b border-[var(--color-stone-100)] p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Wardrobe
                </dt>
                <dd className="mt-1 text-sm">{garments.length} garments</dd>
              </div>
              <div className="border-r border-[var(--color-stone-100)] p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Orders
                </dt>
                <dd className="mt-1 text-sm">{orders.length} recorded</dd>
              </div>
              <div className="p-5">
                <dt className="text-xs text-[var(--color-stone-500)]">
                  Contact
                </dt>
                <dd className="mt-1 text-sm">
                  {customer?.phone ? "Phone ready" : "Email only"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="rounded-[var(--radius-md)]">
            <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
              After this visit
            </p>
            <h2 className="font-display mt-2 text-2xl">Preserve continuity.</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-stone-500)]">
              Complete the status, record the preference in the relationship
              workspace, and start garment intake only when a physical garment
              is present.
            </p>
            {customer ? (
              <Link
                href={`/customers/${customer.id}#clienteling-notes`}
                className="mt-4 inline-flex text-sm underline underline-offset-4"
              >
                Add a private follow-up note →
              </Link>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
