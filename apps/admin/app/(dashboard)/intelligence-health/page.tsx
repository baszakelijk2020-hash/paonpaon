import { IntelligenceObservabilityRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function formatLag(seconds: number | null): string {
  if (seconds === null) return "No samples";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}m`;
}

export default async function IntelligenceHealthPage() {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const health = await new IntelligenceObservabilityRepository(
    supabase,
  ).projectPlatformHealth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Intelligence health
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Aggregate ingestion, correction, and projector-version signals only.
          No retailer customer browsing or content inspection.
        </p>
      </div>

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Explainability
          </p>
          <p className="font-display text-2xl capitalize text-[var(--color-stone-900)]">
            {health.explainabilityHealth}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Events (24h)
          </p>
          <p className="font-display text-2xl text-[var(--color-stone-900)]">
            {health.eventCount24h}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Ingestion lag p95
          </p>
          <p className="font-display text-2xl text-[var(--color-stone-900)]">
            {formatLag(health.ingestionLagSecondsP95)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Corrections (7d)
          </p>
          <p className="font-display text-2xl text-[var(--color-stone-900)]">
            {health.correctionCount7d}
          </p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Correction and outcome rates (7d)
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[var(--color-stone-500)]">Correction rate</dt>
              <dd className="font-display text-2xl text-[var(--color-stone-900)]">
                {Math.round(health.correctionRate7d * 100)}%
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-stone-500)]">
                Incorrect opportunity rate
              </dt>
              <dd className="font-display text-2xl text-[var(--color-stone-900)]">
                {Math.round(health.opportunityIncorrectRate7d * 100)}%
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Active projector versions (7d)
          </h2>
          {health.projectorVersions.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-stone-500)]">
              No projector activity recorded yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {health.projectorVersions.map((row) => (
                <li
                  key={row.version}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="font-mono text-[var(--color-stone-700)]">
                    {row.version}
                  </span>
                  <span className="text-[var(--color-stone-500)]">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
