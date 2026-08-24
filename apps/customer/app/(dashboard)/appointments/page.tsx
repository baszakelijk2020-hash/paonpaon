import {
  AppointmentRepository,
  CustomerRepository,
  RetailerRepository,
} from "@paon/database";
import { APPOINTMENT_TYPE_LABELS } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
        Appointments
      </h1>
      <RelatedLinks links={[{ href: "/concierge", label: "Concierge" }]} />

      {appointments.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No appointments yet. Book a fitting from the storefront.
          </p>
          <Link
            href={bookHref}
            className={buttonVariants({ className: "mt-6" })}
          >
            Book a fitting
          </Link>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {appointments.map((appointment, index) => (
            <Link
              key={appointment.id}
              href={`/appointments/${appointment.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-stone-900)]">
                  {retailers[index]?.displayName ?? "Unknown retailer"}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {APPOINTMENT_TYPE_LABELS[appointment.type]} ·{" "}
                  {formatDate(appointment.startsAt, "en-US")}
                </p>
              </div>
              <AppointmentStatusBadge status={appointment.status} />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
