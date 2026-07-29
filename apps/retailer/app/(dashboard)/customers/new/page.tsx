import { requireRetailerRole } from "@paon/auth";
import { redirect } from "next/navigation";

import { CustomerForm } from "./customer-form";

import { requireSession } from "@/lib/session";

export default async function NewCustomerPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "sales_associate");
  } catch {
    redirect("/customers");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          New customer
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Opens a client book entry for this house. If they later sign in to the
          Private Client portal with the same email, their account links here
          automatically.
        </p>
      </div>
      <CustomerForm />
    </div>
  );
}
