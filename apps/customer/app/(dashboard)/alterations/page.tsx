import {
  CustomerAlterationRepository,
  CustomerRepository,
  RetailerRepository,
} from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { AlterationStatusBadge } from "./status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AlterationsPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const alterationRepo = new CustomerAlterationRepository(supabase);
  const retailerRepo = new RetailerRepository(supabase);

  const alterationsByCustomer = await Promise.all(
    customers.map((customer) => alterationRepo.findByCustomer(customer.id)),
  );
  const alterations = alterationsByCustomer
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const retailers = await Promise.all(
    alterations.map((alteration) =>
      retailerRepo.findById(alteration.retailerId),
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
        Alterations
      </h1>

      {alterations.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">No alterations yet.</p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {alterations.map((alteration, index) => (
            <Link
              key={alteration.id}
              href={`/alterations/${alteration.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {retailers[index]?.displayName ?? "Unknown retailer"}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {formatDate(alteration.createdAt, "en-US")}
                </p>
              </div>
              <AlterationStatusBadge status={alteration.status} />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
