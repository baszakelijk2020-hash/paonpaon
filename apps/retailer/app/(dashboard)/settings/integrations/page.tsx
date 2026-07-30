import { requireRetailerRole } from "@paon/auth";
import { SourceAuthorityRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Smallest useful operator surface for PHASE 8.2 connection health.
 * Does not claim live Faden credentials or a universal connector UI.
 */
export default async function IntegrationsSettingsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const repo = new SourceAuthorityRepository(supabase);
  const [connections, policies, identities, handoffs] = await Promise.all([
    repo.listConnections(session.retailerId),
    repo.listPolicies(session.retailerId),
    repo.listIdentities(session.retailerId, 12),
    repo.listHandoffs(session.retailerId, 8),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/settings"
          className="text-sm text-[var(--color-stone-500)] underline"
        >
          ← Settings
        </Link>
        <h1 className="font-display mt-2 text-2xl text-[var(--color-stone-900)]">
          Source connections
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Authority by domain and field group, external identity mapping, and
          deep-link handoffs. Read-only ingest never invents write-back.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Connections
        </h2>
        {connections.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No connections registered yet. Service-role jobs can create a Faden
            read-only connection without claiming live credentials here.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {connections.map((connection) => (
              <li
                key={connection.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-stone-100)] py-2"
              >
                <span>
                  {connection.displayName} · {connection.provider}
                </span>
                <span className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                  {connection.healthStatus}
                  {connection.lagSeconds > 0
                    ? ` · lag ${connection.lagSeconds}s`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Authority policies
        </h2>
        {policies.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No domain/field-group authority configured.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {policies.map((policy) => (
              <li
                key={policy.id}
                className="border-b border-[var(--color-stone-100)] py-2"
              >
                <span className="font-medium">
                  {policy.domain}/{policy.fieldGroup}
                </span>
                <span className="text-[var(--color-stone-500)]">
                  {" "}
                  · {policy.authority} · {policy.allowedDirections.join(", ")} ·{" "}
                  {policy.mappingVersion}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          External identities
        </h2>
        {identities.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No mapped external identities yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {identities.map((identity) => (
              <li
                key={identity.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-stone-100)] py-2"
              >
                <span>
                  {identity.externalObjectType}/{identity.externalId} →{" "}
                  {identity.canonicalObjectType}
                </span>
                <span className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                  {identity.reconciliationStatus}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Deep-link handoffs
        </h2>
        {handoffs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No open handoffs. Faden write actions surface here as deep links,
            never as fake write-back.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {handoffs.map((handoff) => (
              <li
                key={handoff.id}
                className="border-b border-[var(--color-stone-100)] py-2"
              >
                <a
                  href={handoff.deepLinkUrl}
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {handoff.externalObjectType}/{handoff.externalId}
                </a>
                <span className="text-[var(--color-stone-500)]">
                  {" "}
                  · write-back claimed: {String(
                    handoff.writeBackClaimed,
                  )} · {handoff.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
