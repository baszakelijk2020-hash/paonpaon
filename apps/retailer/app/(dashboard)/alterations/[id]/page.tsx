import {
  AlterationRepository,
  AlterationUpdateRepository,
  CustomerRepository,
} from "@paon/database";
import { asId, retailerRoleAtLeast } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import { notFound } from "next/navigation";

import { AlterationStatusBadge } from "../status-badge";

import { UpdateForm } from "./update-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AlterationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const alteration = await new AlterationRepository(supabase).findById(
    asId<"AlterationId">(id),
  );
  if (!alteration) {
    notFound();
  }

  const [customer, updates] = await Promise.all([
    new CustomerRepository(supabase).findById(alteration.customerId),
    new AlterationUpdateRepository(supabase).findByAlteration(alteration.id),
  ]);

  const canAddUpdate = retailerRoleAtLeast(
    session.retailerRole,
    "production_staff",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
            {customer?.fullName ?? "Unknown customer"}
          </h1>
          <AlterationStatusBadge status={alteration.status} />
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          {alteration.instructions}
        </p>
        {alteration.dueDate ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            Due {formatDate(alteration.dueDate, "en-US")}
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Updates
        </h2>
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {updates.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-stone-500)]">
              No updates yet.
            </p>
          ) : (
            updates.map((update) => (
              <div key={update.id} className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <AlterationStatusBadge status={update.status} />
                  <span className="text-xs text-[var(--color-stone-500)]">
                    {formatDate(update.createdAt, "en-US")}
                  </span>
                </div>
                {update.note ? (
                  <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                    {update.note}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </Card>
      </div>

      {canAddUpdate ? (
        <UpdateForm
          alterationId={alteration.id}
          currentStatus={alteration.status}
        />
      ) : null}
    </div>
  );
}
