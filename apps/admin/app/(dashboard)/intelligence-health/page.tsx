import { IntelligenceHealthRepository } from "@paon/database";
import {
  CUSTOMER_INTEREST_PROJECTOR_VERSION,
  DASHBOARD_PROJECTOR_VERSION,
  DEFAULT_INTELLIGENCE_POLICY,
  FOR_YOU_PROJECTOR_VERSION,
} from "@paon/domain";
import { Card } from "@paon/ui/components/Card";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * PAON admin/ops intelligence health — projection versions, lag, correction
 * rates, and policy defaults. Never browses retailer customer content.
 */
export default async function IntelligenceHealthPage() {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const health = await new IntelligenceHealthRepository(supabase).listRecent(
    30,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Intelligence health
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Projection versions, explainability, and policy configuration — not a
          customer-content browser.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Active projector registry
        </h2>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-stone-700)]">
          <li>{CUSTOMER_INTEREST_PROJECTOR_VERSION}</li>
          <li>{FOR_YOU_PROJECTOR_VERSION}</li>
          <li>{DASHBOARD_PROJECTOR_VERSION}</li>
          <li>{DEFAULT_INTELLIGENCE_POLICY.version}</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Default capability/policy plane
        </h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-stone-500)]">Anonymous capture</dt>
            <dd>
              {DEFAULT_INTELLIGENCE_POLICY.allowAnonymousCapture ? "on" : "off"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-stone-500)]">Activation (spam)</dt>
            <dd>
              {DEFAULT_INTELLIGENCE_POLICY.allowActivation
                ? "allowed"
                : "draft-only"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-stone-500)]">Export</dt>
            <dd>{DEFAULT_INTELLIGENCE_POLICY.allowExport ? "on" : "off"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-stone-500)]">Field mask</dt>
            <dd>{DEFAULT_INTELLIGENCE_POLICY.fieldMask.join(", ")}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Recent projection health
        </h2>
        {health.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No health rows recorded yet. Service-role jobs can insert into
            intelligence_projection_health without exposing customer payloads.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {health.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-stone-100)] py-2"
              >
                <span>
                  {row.projectorVersion} · {row.status}
                  {row.retailerId
                    ? ` · tenant ${row.retailerId.slice(0, 8)}`
                    : ""}
                </span>
                <span className="text-xs text-[var(--color-stone-500)]">
                  lag {row.lagSeconds}s · corrections{" "}
                  {Math.round(row.correctionRate * 100)}% · explainability{" "}
                  {row.explainabilityOk ? "ok" : "needs review"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
