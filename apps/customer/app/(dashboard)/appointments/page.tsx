import {
  AppointmentRepository,
  CustomerRepository,
  RetailerRepository,
} from "@paon/database";
import { APPOINTMENT_TYPE_LABELS } from "@paon/domain";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { RelatedLinks } from "../related-links";

import { AppointmentStatusBadge } from "./status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AppointmentsPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const appointmentRepo = new AppointmentRepository(supabase);
  const retailerRepo = new RetailerRepository(supabase);

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
  const primaryRetailer = primaryCustomer
    ? await retailerRepo.findById(primaryCustomer.retailerId)
    : null;
  const bookHref = primaryRetailer
    ? `/r/${primaryRetailer.slug}`
    : "/r/atelier-demo";
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
            Appointments
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={bookHref} className="customer-button">
            Book appointment
          </Link>
          <RelatedLinks links={[{ href: "/concierge", label: "Concierge" }]} />
        </div>
      </div>

      {upcoming ? (
        <section className="customer-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-stone-500)]">
                Next appointment
              </p>
              <h2 className="font-display mt-2 text-2xl text-[var(--color-stone-900)]">
                {retailerById.get(upcoming.id)?.displayName ??
                  "Unknown retailer"}
              </h2>
              <p className="mt-1 text-[var(--color-stone-700)]">
                {APPOINTMENT_TYPE_LABELS[upcoming.type]}
              </p>
            </div>
            <AppointmentStatusBadge status={upcoming.status} />
          </div>
          <p className="mt-5 text-sm text-[var(--color-stone-700)]">
            {formatDate(upcoming.startsAt, "en-US")} ·{" "}
            {formatRange(upcoming.startsAt, upcoming.endsAt)}
          </p>
          {upcoming.notes ? (
            <p className="mt-3 line-clamp-2 text-sm text-[var(--color-stone-600)]">
              {upcoming.notes}
            </p>
          ) : null}
          <Link
            href={`/appointments/${upcoming.id}`}
            className="customer-text-link mt-5 inline-flex text-sm font-medium underline underline-offset-4"
          >
            View appointment details
          </Link>
        </section>
      ) : appointments.length === 0 ? (
        <div className="customer-panel px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No appointments yet. Book a fitting from the storefront.
          </p>
          <Link href={bookHref} className="customer-button mt-6">
            Book a fitting
          </Link>
        </div>
      ) : null}

      {history.length > 0 ? (
        <section>
          <h2 className="font-display mb-3 text-xl text-[var(--color-stone-900)]">
            Appointment history
          </h2>
          <div className="customer-panel divide-y divide-[var(--color-stone-100)] p-0">
            {history.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/appointments/${appointment.id}`}
                className="customer-list-row flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {retailerById.get(appointment.id)?.displayName ??
                      "Unknown retailer"}
                  </p>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {APPOINTMENT_TYPE_LABELS[appointment.type]} ·{" "}
                    {formatDate(appointment.startsAt, "en-US")} ·{" "}
                    {formatRange(appointment.startsAt, appointment.endsAt)}
                  </p>
                </div>
                <AppointmentStatusBadge status={appointment.status} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
