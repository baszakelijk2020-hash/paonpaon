"use client";

import type { RetailerStatus } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { SearchableCollection } from "@paon/ui/components/SearchableCollection";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { RetailerStatusBadge } from "./status-badge";

export type RetailerNetworkRow = {
  id: string;
  displayName: string;
  slug: string;
  status: RetailerStatus;
  tier: string;
  defaultLocale: string;
  createdAt: string;
};

export function RetailersNetworkList({
  retailers,
}: {
  retailers: RetailerNetworkRow[];
}) {
  return (
    <SearchableCollection
      items={retailers}
      placeholder="Search retailer name or slug…"
      label="Search retailers"
      predicate={(retailer, query) =>
        retailer.displayName.toLowerCase().includes(query) ||
        retailer.slug.toLowerCase().includes(query) ||
        retailer.tier.toLowerCase().includes(query)
      }
      empty={
        <p className="text-sm text-[var(--color-stone-500)]">
          No retailers match that search.
        </p>
      }
    >
      {(filtered) => (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((retailer) => (
            <Link
              key={retailer.id}
              href={`/retailers/${retailer.id}`}
              className="group"
            >
              <Card className="h-full overflow-hidden rounded-[var(--radius-md)] p-0 transition-transform duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lifted)]">
                <div className="flex items-start justify-between gap-4 p-6">
                  <div>
                    <p className="font-display text-3xl">
                      {retailer.displayName}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[var(--color-stone-500)]">
                      /{retailer.slug}
                    </p>
                  </div>
                  <RetailerStatusBadge status={retailer.status} />
                </div>
                <dl className="grid grid-cols-3 border-t border-[var(--color-stone-100)]">
                  <div className="border-r border-[var(--color-stone-100)] p-4">
                    <dt className="text-[11px] text-[var(--color-stone-500)]">
                      Tier
                    </dt>
                    <dd className="mt-1 text-sm capitalize">{retailer.tier}</dd>
                  </div>
                  <div className="border-r border-[var(--color-stone-100)] p-4">
                    <dt className="text-[11px] text-[var(--color-stone-500)]">
                      Locale
                    </dt>
                    <dd className="mt-1 text-sm">{retailer.defaultLocale}</dd>
                  </div>
                  <div className="p-4">
                    <dt className="text-[11px] text-[var(--color-stone-500)]">
                      Joined
                    </dt>
                    <dd className="mt-1 text-sm">
                      {formatDate(retailer.createdAt, "en-US")}
                    </dd>
                  </div>
                </dl>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </SearchableCollection>
  );
}
