import { RetailerRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { RetailerStatusBadge } from "./status-badge";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function RetailersPage() {
  const supabase = await getSupabaseServerClient();
  const retailers = await new RetailerRepository(supabase).list();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
            Retailers
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            {retailers.length} retailer{retailers.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/retailers/new" className={buttonVariants()}>
          New retailer
        </Link>
      </div>

      {retailers.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No retailers yet. Onboard the first one to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-stone-200)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--color-stone-200)] text-[var(--color-stone-500)]">
              <tr>
                <th className="px-4 py-3 font-medium">Retailer</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {retailers.map((retailer) => (
                <tr
                  key={retailer.id}
                  className="border-b border-[var(--color-stone-100)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/retailers/${retailer.id}`}
                      className="font-medium text-[var(--color-stone-900)] hover:underline"
                    >
                      {retailer.displayName}
                    </Link>
                    <div className="text-[var(--color-stone-500)]">
                      {retailer.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-[var(--color-stone-700)]">
                    {retailer.tier}
                  </td>
                  <td className="px-4 py-3">
                    <RetailerStatusBadge status={retailer.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-stone-500)]">
                    {formatDate(retailer.createdAt, "en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
