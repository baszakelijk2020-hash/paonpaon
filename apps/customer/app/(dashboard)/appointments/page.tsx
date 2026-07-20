import {
  AppointmentRepository,
  CustomerRepository,
  RetailerRepository,
} from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-[var(--font-display)] text-[var(--color-stone-900)]">
        Appointments
      </h1>

      {appointments.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No appointments yet. Visit a retailer&rsquo;s storefront to request
            one.
          </p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {appointments.map((appointment, index) => (
            <Link
              key={appointment.id}
              href={`/appointments/${appointment.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {retailers[index]?.displayName ?? "Unknown retailer"}
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
