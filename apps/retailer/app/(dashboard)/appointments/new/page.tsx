import { requireRetailerRole } from "@paon/auth";
import { CustomerRepository, RetailerStaffRepository } from "@paon/database";
import { redirect } from "next/navigation";

import { AppointmentForm } from "./appointment-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function NewAppointmentPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "sales_associate");
  } catch {
    redirect("/appointments");
  }

  const supabase = await getSupabaseServerClient();
  const [customers, staff] = await Promise.all([
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
    new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
          New appointment
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Book directly for an existing customer — e.g. a walk-in or phone
          request.
        </p>
      </div>
      <AppointmentForm customers={customers} staff={staff} />
    </div>
  );
}
