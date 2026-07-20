import { requirePlatformOperator } from "@paon/auth";
import { redirect } from "next/navigation";

import { RetailerForm } from "./retailer-form";

import { getSession } from "@/lib/session";

export default async function NewRetailerPage() {
  const session = await getSession();
  try {
    requirePlatformOperator(session);
  } catch {
    redirect("/retailers");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
          New retailer
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Creates the tenant and invites its first owner in one step.
        </p>
      </div>
      <RetailerForm />
    </div>
  );
}
