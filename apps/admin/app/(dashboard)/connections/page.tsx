import { SourceAuthorityRepository } from "@paon/database";
import { SOURCE_AUTHORITY_REGISTRY_VERSION } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Platform connection health — registry versions, lag, and open conflicts.
 * Never exposes customer payloads from raw snapshots.
 */
export default async function ConnectionsPage() {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const repository = new SourceAuthorityRepository(supabase);
  const [connections, health] = await Promise.all([
    repository.listAllConnections(100),
    repository.listRecentHealth(undefined, 40),
  ]);

  const conflictCount = health.reduce(
    (total, event) => total + event.openConflictCount,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Connection health
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Source authority registry, connector lag, and reconciliation conflicts
          across the retailer network.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Registry version
        </h2>
        <p className="mt-2 text-sm text-[var(--color-stone-700)]">
          {SOURCE_AUTHORITY_REGISTRY_VERSION}
        </p>
        <p className="mt-1 text-xs text-[var(--color-stone-500)]">
          {connections.length} connection(s) · {conflictCount} open conflict
          signal(s) in recent health rows
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Connections
        </h2>
        {connections.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No connections registered yet. Retailers exercise the Faden fixture
            from Settings → Connections.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {connections.map((connection) => (
              <li
                key={connection.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-stone-100)] py-2"
              >
                <span>
                  {connection.label} · {connection.provider} ·{" "}
                  {connection.status}
                </span>
                <span className="text-xs text-[var(--color-stone-500)]">
                  tenant {connection.retailerId.slice(0, 8)} · mapping{" "}
                  {connection.mappingVersion}
                  {connection.lastSyncAt
                    ? ` · last sync ${connection.lastSyncAt}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Recent connector health
        </h2>
        {health.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No health events recorded yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {health.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-stone-100)] py-2"
              >
                <span>
                  {row.status} · connection {row.connectionId.slice(0, 8)}
                </span>
                <span className="text-xs text-[var(--color-stone-500)]">
                  lag {row.lagSeconds}s · conflicts {row.openConflictCount}
                  {row.notes ? ` · ${row.notes}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
