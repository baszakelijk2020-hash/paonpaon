import { requireRetailerRole } from "@paon/auth";
import { WorkshopRepository } from "@paon/database";
import { redirect } from "next/navigation";

import { StaffForm } from "./staff-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function NewStaffPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }

  const workshops = await new WorkshopRepository(
    await getSupabaseServerClient(),
  ).findByRetailer(session.retailerId);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Invite staff
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          They&rsquo;ll receive an email invite to set a password and sign in to
          the Retailer Portal.
        </p>
      </div>
      <StaffForm workshops={workshops} />
    </div>
  );
}
