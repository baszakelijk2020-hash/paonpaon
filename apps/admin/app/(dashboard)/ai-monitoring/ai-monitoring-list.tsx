"use client";

import {
  AI_GENERATION_KIND_LABELS,
  AI_GENERATION_STATUS_LABELS,
  type AIGenerationKind,
  type AIGenerationStatus,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { SearchableCollection } from "@paon/ui/components/SearchableCollection";
import { formatDate } from "@paon/utils";

export type AIGenerationRow = {
  id: string;
  retailerName: string;
  status: AIGenerationStatus | string;
  kind: AIGenerationKind | string;
  provider: string;
  model: string;
  latencyMs?: number;
  createdAt: string;
  errorMessage?: string;
};

function kindLabel(kind: string): string {
  return (
    AI_GENERATION_KIND_LABELS[kind as AIGenerationKind] ??
    kind.replaceAll("_", " ")
  );
}

function statusLabel(status: string): string {
  return (
    AI_GENERATION_STATUS_LABELS[status as AIGenerationStatus] ??
    status.replaceAll("_", " ")
  );
}

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
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {filtered.map((generation) => (
            <div key={generation.id} className="flex flex-col gap-1 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-[var(--color-stone-900)]">
                  {generation.retailerName}
                </p>
                <Badge
                  tone={
                    generation.status === "succeeded" ? "success" : "danger"
                  }
                >
                  {statusLabel(generation.status)}
                </Badge>
              </div>
              <p className="text-sm text-[var(--color-stone-600)]">
                {kindLabel(generation.kind)} · {generation.provider}/
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
