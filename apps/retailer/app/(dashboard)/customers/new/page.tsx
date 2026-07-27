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
          Adds a CRM record for this retailer. If they later sign in to Customer
          Portal with the same email, their account links to this record
          automatically.
        </p>
      </div>
      <CustomerForm />
    </div>
  );
}
