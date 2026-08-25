import {
  AppointmentRepository,
  CustomerRepository,
  RetailerBranchRepository,
  RetailerRepository,
} from "@paon/database";
import { APPOINTMENT_TYPE_LABELS } from "@paon/domain";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { RelatedLinks } from "../related-links";

import { BookAppointmentLauncher } from "./book-appointment-launcher";
import type { BookableBranch } from "./booking-flow";
import { AppointmentStatusBadge } from "./status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const INSPIRATION_APPOINTMENTS = [
  {
    id: "fall-winter-2026",
    dateLabel: "September 2026",
    title: "Fall/Winter Wardrobe Appointment",
    treatment: "linear-gradient(135deg, #56665a 0%, #222b24 100%)",
  },
  {
    id: "spring-summer-2027",
    dateLabel: "February 2027",
    title: "Spring/Summer 2027 Wardrobe Appointment",
    treatment: "linear-gradient(135deg, #7c8772 0%, #3f493b 100%)",
  },
  {
    id: "summer-holiday-2027",
    dateLabel: "April 2027",
    title: "Summer Holiday 2027 Wardrobe Appointment",
    treatment: "linear-gradient(135deg, #8e7762 0%, #40342c 100%)",
  },
  {
    id: "holiday-season-2027",
    dateLabel: "November 2027",
    title: "Holiday Season Look Appointment",
    treatment: "linear-gradient(135deg, #5f4d49 0%, #302624 100%)",
  },
] as const;

export default async function AppointmentsPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const appointmentRepo = new AppointmentRepository(supabase);
  const retailerRepo = new RetailerRepository(supabase);
  const branchRepo = new RetailerBranchRepository(supabase);

  const appointmentsByCustomer = await Promise.all(
    customers.map((customer) => appointmentRepo.findByCustomer(customer.id)),
  );
  const appointments = appointmentsByCustomer
    .flat()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const retailers = await Promise.all(
    appointments.map((appointment) =>
      retailerRepo.findById(appointment.retailerId),
    ),
  );

  const primaryCustomer = customers[0];
  const bookableBranches: readonly BookableBranch[] = primaryCustomer
    ? (await branchRepo.listByRetailer(primaryCustomer.retailerId)).map(
        (branch) => ({
          id: branch.id,
          name: branch.name,
          openingHours: branch.openingHours,
        }),
      )
    : [];
  const now = Date.now();
  const upcoming = appointments.find(
    (appointment) =>
      !["completed", "canceled", "no_show"].includes(appointment.status) &&
      new Date(appointment.startsAt).getTime() >= now,
  );
  const history = appointments.filter(
    (appointment) => appointment.id !== upcoming?.id,
  );
  const retailerById = new Map(
    appointments.map((appointment, index) => [
      appointment.id,
      retailers[index],
    ]),
  );
  const formatTime = (iso: string) =>
    formatDate(iso, "en-US", { hour: "numeric", minute: "2-digit" });
  const formatRange = (startsAt: string, endsAt: string) =>
    `${formatTime(startsAt)}–${formatTime(endsAt)}`;

  return (
    <div className="customer-page flex flex-col gap-8">
      <div className="customer-page-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="customer-kicker text-sm font-medium uppercase tracking-[0.16em]">
            Your visits
          </p>
          <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
            My Appointments
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {primaryCustomer ? (
            <BookAppointmentLauncher
              retailerId={primaryCustomer.retailerId}
              branches={bookableBranches}
            />
          ) : null}
          <RelatedLinks links={[{ href: "/concierge", label: "Concierge" }]} />
        </div>
      </div>

      {primaryCustomer ? (
        <section>
          <h2 className="font-display mb-3 text-xl text-[var(--color-stone-900)]">
            Suggestions to book
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {INSPIRATION_APPOINTMENTS.map((card) => (
              <div
                key={card.id}
                className="flex min-h-32 flex-col justify-end gap-3 rounded-[15px] p-5 text-white shadow-[inset_0_-80px_80px_rgba(0,0,0,0.16)]"
                style={{ background: card.treatment }}
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-stone-400)]">
                    {card.dateLabel}
                  </p>
                  <p className="font-display mt-1 text-base">{card.title}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {upcoming ? (
        <section className="customer-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-stone-500)]">
                Next appointment
              </p>
              <h2 className="font-display mt-2 text-2xl text-[var(--color-stone-900)]">
                {APPOINTMENT_TYPE_LABELS[upcoming.type]}
              </h2>
              <p className="mt-1 text-[var(--color-stone-700)]">
                {retailerById.get(upcoming.id)?.displayName ??
                  "Unknown retailer"}
              </p>
            </div>
            <AppointmentStatusBadge status={upcoming.status} />
          </div>
          <p className="mt-5 text-sm text-[var(--color-stone-700)]">
            {formatDate(upcoming.startsAt, "en-US")} ·{" "}
            {formatRange(upcoming.startsAt, upcoming.endsAt)}
          </p>
        </section>
      ) : !primaryCustomer ? (
        <div className="customer-panel px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No retailer connection yet.
          </p>
        </div>
      ) : null}

      {history.length > 0 ? (
        <details className="customer-panel p-0">
          <summary className="font-display cursor-pointer list-none px-6 py-4 text-xl text-[var(--color-stone-900)]">
            Appointment history ({history.length})
          </summary>
          <div className="divide-y divide-[var(--color-stone-100)]">
            {history.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/appointments/${appointment.id}`}
                className="customer-list-row flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {APPOINTMENT_TYPE_LABELS[appointment.type]}
                  </p>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {retailerById.get(appointment.id)?.displayName ??
                      "Unknown retailer"}{" "}
                    · {formatDate(appointment.startsAt, "en-US")} ·{" "}
                    {formatRange(appointment.startsAt, appointment.endsAt)}
                  </p>
                </div>
                <AppointmentStatusBadge status={appointment.status} />
              </Link>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
