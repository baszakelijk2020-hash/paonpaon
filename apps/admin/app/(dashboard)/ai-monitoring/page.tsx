import { AIGenerationRepository, RetailerRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";

import { AIMonitoringList } from "./ai-monitoring-list";

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
  const rows = generations.map((generation) => ({
    id: generation.id,
    retailerName: retailerNameById.get(generation.retailerId) ?? "Retailer",
    status: generation.status,
    kind: generation.kind,
    provider: generation.provider,
    model: generation.model,
    ...(generation.latencyMs !== undefined
      ? { latencyMs: generation.latencyMs }
      : {}),
    createdAt: generation.createdAt,
    ...(generation.errorMessage
      ? { errorMessage: generation.errorMessage }
      : {}),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
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
          <p className="font-display text-2xl text-[var(--color-stone-900)]">
            {generations.length}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Succeeded
          </p>
          <p className="font-display text-2xl text-[var(--color-stone-900)]">
            {succeeded}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Failed
          </p>
          <p className="font-display text-2xl text-[var(--color-stone-900)]">
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
        <AIMonitoringList rows={rows} />
      )}
    </div>
  );
}
