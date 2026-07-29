import { requireAlterationsPermission } from "@paon/auth";
import { WorkshopRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { redirect } from "next/navigation";

import { WorkshopForm } from "./workshop-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function WorkshopsPage() {
  const session = await requireSession();
  try {
    requireAlterationsPermission(session.retailerRole, "configure");
  } catch {
    redirect("/alterations");
  }
  const workshops = await new WorkshopRepository(
    await getSupabaseServerClient(),
  ).findByRetailer(session.retailerId);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Workshops</h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Create retailer-scoped workshops, then invite workshop managers and
          workers from Team.
        </p>
      </div>
      <Card>
        <WorkshopForm />
      </Card>
      <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]">
        {workshops.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-stone-500)]">
            No workshops configured.
          </p>
        ) : (
          workshops.map((workshop) => (
            <div key={workshop.id} className="px-6 py-4">
              <p className="font-medium">{workshop.name}</p>
              <p className="text-sm text-[var(--color-stone-500)]">
                {workshop.email ?? "No email"} · {workshop.status}
              </p>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
