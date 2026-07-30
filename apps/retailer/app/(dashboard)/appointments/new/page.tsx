import { requireRetailerRole } from "@paon/auth";
import {
  CustomerRepository,
  RetailerBranchRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { redirect } from "next/navigation";

import { AppointmentForm } from "./appointment-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "sales_associate");
  } catch {
    redirect("/appointments");
  }

  const { customerId } = await searchParams;
  const supabase = await getSupabaseServerClient();
  const branchRepo = new RetailerBranchRepository(supabase);
  const [customers, staff, branches] = await Promise.all([
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
    new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
    branchRepo.listByRetailer(session.retailerId),
  ]);
  const ensuredBranches =
    branches.length > 0
      ? branches
      : [
          await branchRepo.ensureDefaultBranch({
            retailerId: session.retailerId,
            timezone: "Europe/Amsterdam",
          }),
        ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          New appointment
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Book directly for an existing customer — e.g. a walk-in or phone
          request. Start/end times use the selected branch timezone.
        </p>
      </div>
      <AppointmentForm
        customers={customers}
        staff={staff}
        branches={ensuredBranches}
        {...(customerId ? { defaultCustomerId: customerId } : {})}
      />
    </div>
  );
}
