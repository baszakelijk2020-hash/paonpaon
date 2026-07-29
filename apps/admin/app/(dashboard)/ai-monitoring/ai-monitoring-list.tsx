"use client";

import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { SearchableCollection } from "@paon/ui/components/SearchableCollection";
import { formatDate, humaniseStatus } from "@paon/utils";

export type AIGenerationRow = {
  id: string;
  retailerName: string;
  status: string;
  kind: string;
  provider: string;
  model: string;
  latencyMs?: number;
  createdAt: string;
  errorMessage?: string;
};

export function AIMonitoringList({ rows }: { rows: AIGenerationRow[] }) {
  return (
    <SearchableCollection
      items={rows}
      placeholder="Search retailer, status or model…"
      label="Search AI generations"
      predicate={(row, query) =>
        row.retailerName.toLowerCase().includes(query) ||
        row.status.toLowerCase().includes(query) ||
        row.kind.toLowerCase().includes(query) ||
        row.provider.toLowerCase().includes(query) ||
        row.model.toLowerCase().includes(query) ||
        (row.errorMessage?.toLowerCase().includes(query) ?? false)
      }
      empty={
        <p className="p-6 text-sm text-[var(--color-stone-500)]">
          No generations match that search.
        </p>
      }
    >
      {(filtered) => (
        <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-xl)] p-0 shadow-[var(--shadow-elevated)]">
          {filtered.map((generation) => (
            <div key={generation.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-[var(--color-stone-900)]">
                  {generation.retailerName}
                </p>
                <Badge
                  tone={
                    generation.status === "succeeded" ? "success" : "danger"
                  }
                >
                  {humaniseStatus(generation.status)}
                </Badge>
              </div>
              <p className="text-sm text-[var(--color-stone-600)]">
                {generation.kind.replaceAll("_", " ")} · {generation.provider}/
                {generation.model}
                {generation.latencyMs !== undefined
                  ? ` · ${generation.latencyMs}ms`
                  : ""}
              </p>
              <p className="text-xs text-[var(--color-stone-500)]">
                {formatDate(generation.createdAt, "en-US")}
              </p>
              {generation.errorMessage ? (
                <p className="mt-1 text-sm text-[var(--color-danger-500)]">
                  {generation.errorMessage}
                </p>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </SearchableCollection>
  );
}
