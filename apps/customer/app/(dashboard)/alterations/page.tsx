import {
  CustomerAlterationRepository,
  CustomerRepository,
  RetailerRepository,
} from "@paon/database";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { AlterationStatusBadge } from "./status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const REQUEST_ALTERATION_HREF = `/messages?prefill=${encodeURIComponent(
  "I'd like to request an alteration for a garment.",
)}`;

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
    <div className="customer-page flex flex-col gap-6">
      <header className="customer-page-header flex-wrap items-end">
        <h1 className="font-display text-4xl text-[var(--customer-ink)]">
          Alterations
        </h1>
        <Link href={REQUEST_ALTERATION_HREF} className="customer-button">
          Request alteration
        </Link>
      </header>

      {alterations.length === 0 ? (
        <div className="customer-panel px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">No alterations yet.</p>
          <Link href={REQUEST_ALTERATION_HREF} className="customer-button mt-6">
            Request alteration
          </Link>
        </div>
      ) : (
        <div className="customer-panel divide-y divide-[var(--customer-border)] p-0">
          {alterations.map((alteration, index) => (
            <Link
              key={alteration.id}
              href={`/alterations/${alteration.id}`}
              className="customer-list-row flex-wrap px-6 py-5 hover:bg-white/70"
            >
              <div className="min-w-0">
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
        </div>
      )}
    </div>
  );
}
