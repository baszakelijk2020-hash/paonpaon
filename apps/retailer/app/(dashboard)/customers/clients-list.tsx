"use client";

import type { Customer } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { SearchableCollection } from "@paon/ui/components/SearchableCollection";
import Link from "next/link";

import { LifecycleBadge } from "./lifecycle-badge";

export function ClientsList({ customers }: { customers: Customer[] }) {
  return (
    <SearchableCollection
      items={customers}
      placeholder="Search by name, email or phone…"
      label="Search clients"
      predicate={(customer, query) =>
        customer.fullName.toLowerCase().includes(query) ||
        (customer.email?.toLowerCase().includes(query) ?? false) ||
        (customer.phone?.toLowerCase().includes(query) ?? false)
      }
      empty={
        <p className="text-sm text-[var(--color-stone-500)]">
          No clients match that search.
        </p>
      }
    >
      {(filtered) => (
        <Card className="paon-reveal divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]">
          {filtered.map((customer) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div className="min-w-0">
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
    </SearchableCollection>
  );
}
