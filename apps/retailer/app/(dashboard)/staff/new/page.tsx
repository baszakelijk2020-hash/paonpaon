import { requireRetailerRole } from "@paon/auth";
import { redirect } from "next/navigation";

import { StaffForm } from "./staff-form";

import { requireSession } from "@/lib/session";

export default async function NewStaffPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
          Invite staff
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          They&rsquo;ll receive an email invite to set a password and sign in to
          the Retailer Portal.
        </p>
      </div>
      <StaffForm />
    </div>
  );
}
