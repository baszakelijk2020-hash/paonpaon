import { CustomerRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";

import { LifecycleBadge } from "./lifecycle-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function CustomersPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByRetailer(
    session.retailerId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
            Customers
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            {customers.length} customer{customers.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/customers/new" className={buttonVariants()}>
          New customer
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No customers yet. Add the first one to start building your client
            book.
          </p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {customers.map((customer) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {customer.fullName}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {customer.email ?? "No email on file"}
                  {customer.phone ? ` · ${customer.phone}` : ""}
                </p>
              </div>
              <LifecycleBadge stage={customer.lifecycleStage} />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
