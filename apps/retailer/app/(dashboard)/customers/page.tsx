import { CustomerRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";

import { ClientsList } from "./clients-list";

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            Clients
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            {customers.length} client{customers.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/customers/new" className={buttonVariants()}>
          New client
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="paon-reveal rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No clients yet. Add the first one to start the client book.
          </p>
          <Link
            href="/customers/new"
            className={buttonVariants({ className: "mt-6" })}
          >
            New client
          </Link>
        </div>
      ) : (
        <ClientsList customers={customers} />
      )}
    </div>
  );
}
