import { AppointmentRepository, CustomerRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";

import { AppointmentsList } from "./appointments-list";

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
  const customerNameById = Object.fromEntries(
    customers.map((customer) => [customer.id, customer.fullName]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
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
        <div className="paon-reveal rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">No appointments yet.</p>
          <Link
            href="/appointments/new"
            className={buttonVariants({ className: "mt-6" })}
          >
            New appointment
          </Link>
          <p className="mt-4 text-sm text-[var(--color-stone-500)]">
            Empty diary? Check{" "}
            <Link href="/appointments/availability" className="underline">
              availability windows
            </Link>{" "}
            first.
          </p>
        </div>
      ) : (
        <AppointmentsList
          appointments={appointments}
          customerNameById={customerNameById}
        />
      )}
    </div>
  );
}
