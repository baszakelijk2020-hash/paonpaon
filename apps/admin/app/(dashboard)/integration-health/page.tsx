import {
  FADEN_ADAPTER_VERSION,
  FADEN_FIXTURE_MAPPING_VERSION,
  INTEGRATION_CONNECTION_PROJECTOR_VERSION,
  SHOPIFY_ADAPTER_VERSION,
} from "@paon/domain";
import { Card } from "@paon/ui/components/Card";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Platform ops view of connection health — not a universal connector UI and
 * not a claim of live Faden credentials (PHASE 8.2).
 */
export default async function IntegrationHealthPage() {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  // Platform staff RLS allows select across tenants; we still avoid browsing
  // raw payloads here — only connection health metadata.
  const { data, error } = await supabase
    .from("integration_connections")
    .select(
      "id, retailer_id, provider, display_name, health_status, lag_seconds, last_success_at, last_error_summary, updated_at",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw error;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Integration health
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Source-authority connection status and mapping versions. Live Faden
          credentials are not required for the provider-neutral contract.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Contract versions
        </h2>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-stone-700)]">
          <li>{INTEGRATION_CONNECTION_PROJECTOR_VERSION}</li>
          <li>{FADEN_FIXTURE_MAPPING_VERSION}</li>
          <li>{SHOPIFY_ADAPTER_VERSION}</li>
          <li>{FADEN_ADAPTER_VERSION}</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Recent connections
        </h2>
        {data.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No integration connections recorded yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {data.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-stone-100)] py-2"
              >
                <span>
                  {row.display_name} · {row.provider} · tenant{" "}
                  {row.retailer_id.slice(0, 8)}
                </span>
                <span className="text-xs text-[var(--color-stone-500)]">
                  {row.health_status} · lag {row.lag_seconds}s
                  {row.last_error_summary ? ` · ${row.last_error_summary}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
