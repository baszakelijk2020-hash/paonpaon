import { AIGenerationRepository, RetailerRepository } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AIMonitoringPage() {
  await requireSession();
  const supabase = await getSupabaseServerClient();

  const generations = await new AIGenerationRepository(supabase).findRecent(50);
  const retailerRepo = new RetailerRepository(supabase);
  const retailerIds = [...new Set(generations.map((g) => g.retailerId))];
  const retailers = await Promise.all(
    retailerIds.map((id) => retailerRepo.findById(id)),
  );
  const retailerNameById = new Map(
    retailerIds.map((id, index) => [id, retailers[index]?.displayName ?? id]),
  );

  const succeeded = generations.filter((g) => g.status === "succeeded").length;
  const failed = generations.length - succeeded;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
          AI monitoring
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Every AI personalisation attempt across every retailer — the last 50,
          most recent first.
        </p>
      </div>

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Total
          </p>
          <p className="text-2xl font-medium text-[var(--color-stone-900)]">
            {generations.length}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Succeeded
          </p>
          <p className="text-2xl font-medium text-[var(--color-stone-900)]">
            {succeeded}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Failed
          </p>
          <p className="text-2xl font-medium text-[var(--color-stone-900)]">
            {failed}
          </p>
        </div>
      </Card>

      {generations.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            No AI generations recorded yet.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {generations.map((generation) => (
            <div key={generation.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-[var(--color-stone-900)]">
                  {retailerNameById.get(generation.retailerId)}
                </p>
                <Badge
                  tone={
                    generation.status === "succeeded" ? "success" : "danger"
                  }
                >
                  {generation.status}
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
    </div>
  );
}
