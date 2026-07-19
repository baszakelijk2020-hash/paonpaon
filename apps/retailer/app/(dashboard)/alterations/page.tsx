import { AlterationRepository, CustomerRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { AlterationStatusBadge } from "./status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AlterationsPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const alterations = await new AlterationRepository(supabase).findByRetailer(
    session.retailerId,
  );
  const customers = await new CustomerRepository(supabase).findByRetailer(
    session.retailerId,
  );
  const customerNameById = new Map(
    customers.map((customer) => [customer.id, customer.fullName]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
            Alterations
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            {alterations.length} alteration
            {alterations.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/alterations/new" className={buttonVariants()}>
          New alteration
        </Link>
      </div>

      {alterations.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">No alterations yet.</p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {alterations.map((alteration) => (
            <Link
              key={alteration.id}
              href={`/alterations/${alteration.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {customerNameById.get(alteration.customerId) ??
                    "Unknown customer"}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {alteration.instructions.length > 80
                    ? `${alteration.instructions.slice(0, 80)}…`
                    : alteration.instructions}
                </p>
                <p className="text-xs text-[var(--color-stone-500)]">
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
