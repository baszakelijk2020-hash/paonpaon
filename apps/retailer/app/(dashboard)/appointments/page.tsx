import { AppointmentRepository, CustomerRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { AppointmentStatusBadge } from "./status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AppointmentsPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const appointments = await new AppointmentRepository(supabase).findByRetailer(
    session.retailerId,
  );

  const customers = await new CustomerRepository(supabase).findByRetailer(
    session.retailerId,
  );
  const customerNameById = new Map(
    customers.map((customer) => [customer.id, customer.fullName]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
            Appointments
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            {appointments.length} appointment
            {appointments.length === 1 ? "" : "s"} ·{" "}
            <Link href="/appointments/availability" className="underline">
              Availability
            </Link>
          </p>
        </div>
        <Link href="/appointments/new" className={buttonVariants()}>
          New appointment
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">No appointments yet.</p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-xl)] p-0 shadow-[var(--shadow-elevated)]">
          {appointments.map((appointment) => (
            <Link
              key={appointment.id}
              href={`/appointments/${appointment.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {customerNameById.get(appointment.customerId) ??
                    "Unknown customer"}
                </p>
                <p className="text-sm capitalize text-[var(--color-stone-500)]">
                  {appointment.type.replaceAll("_", " ")} ·{" "}
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
