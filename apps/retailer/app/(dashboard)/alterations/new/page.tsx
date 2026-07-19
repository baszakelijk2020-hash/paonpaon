import { requireRetailerRole } from "@paon/auth";
import { CustomerRepository } from "@paon/database";
import { redirect } from "next/navigation";

import { AlterationForm } from "./alteration-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function NewAlterationPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "sales_associate");
  } catch {
    redirect("/alterations");
  }

  const { customerId } = await searchParams;
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByRetailer(
    session.retailerId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
          New alteration
        </h1>
      </div>
      <AlterationForm
        customers={customers}
        {...(customerId ? { defaultCustomerId: customerId } : {})}
      />
    </div>
  );
}
