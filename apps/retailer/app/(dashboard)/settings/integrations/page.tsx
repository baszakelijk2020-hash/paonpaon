import { requireRetailerRole } from "@paon/auth";
import {
  IntegrationLifecycleRepository,
  SourceAuthorityRepository,
} from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ConnectionLifecycleControls } from "./connection-lifecycle-controls";
import { CreateConnectionForm } from "./create-connection-form";
import { ShopifySyncButton } from "./shopify-sync-button";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Smallest useful operator surface for PHASE 8.2 connection health, plus
 * the PHASE 9.2 lifecycle controls and observability the queue's own
 * acceptance criteria call out by name: "signature/replay/cursor/failure/
 * retry/reconcile are observable."
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
  const lifecycle = new IntegrationLifecycleRepository(supabase);
  const [connections, policies, identities, handoffs] = await Promise.all([
    repo.listConnections(session.retailerId),
    repo.listPolicies(session.retailerId),
    repo.listIdentities(session.retailerId, 12),
    repo.listHandoffs(session.retailerId, 8),
  ]);

  const lifecycleByConnection = await Promise.all(
    connections.map(async (connection) => ({
      connectionId: connection.id,
      runs: await lifecycle.listSyncRuns({
        retailerId: session.retailerId,
        connectionId: connection.id,
        limit: 5,
      }),
      deadLetters: await lifecycle.listUnresolvedDeadLetters({
        retailerId: session.retailerId,
        connectionId: connection.id,
        limit: 10,
      }),
      reconciliationReports: await lifecycle.listReconciliationReports({
        retailerId: session.retailerId,
        connectionId: connection.id,
        limit: 5,
      }),
    })),
  );

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
          New connection
        </h2>
        <div className="mt-3">
          <CreateConnectionForm />
        </div>
      </Card>

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
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                    {connection.healthStatus}
                    {connection.lagSeconds > 0
                      ? ` · lag ${connection.lagSeconds}s`
                      : ""}
                    {" · "}
                    {connection.operationalState}
                  </span>
                  {connection.provider === "shopify" ? (
                    <ShopifySyncButton connectionId={connection.id} />
                  ) : null}
                  <ConnectionLifecycleControls
                    connectionId={connection.id}
                    operationalState={connection.operationalState}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Sync runs and dead letters
        </h2>
        <p className="mt-1 text-xs text-[var(--color-stone-500)]">
          Every scheduled or webhook-triggered run, and any event a connection
          could not process. A run failing here does not silently disappear — it
          is either resolved or stays visible until it is.
        </p>
        {lifecycleByConnection.every(
          (entry) => entry.runs.length === 0 && entry.deadLetters.length === 0,
        ) ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No sync runs recorded yet.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-4 text-sm">
            {lifecycleByConnection.map((entry) => {
              const connection = connections.find(
                (candidate) => candidate.id === entry.connectionId,
              );
              if (
                !connection ||
                (entry.runs.length === 0 && entry.deadLetters.length === 0)
              ) {
                return null;
              }
              return (
                <div key={entry.connectionId}>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
                    {connection.displayName}
                  </p>
                  {entry.runs.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-1">
                      {entry.runs.map((run) => (
                        <li
                          key={run.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-stone-100)] py-1"
                        >
                          <span>
                            {run.triggerKind} · {run.status} ·{" "}
                            {run.recordsProcessed} processed,{" "}
                            {run.recordsFailed} failed
                          </span>
                          <span className="text-xs text-[var(--color-stone-500)]">
                            {new Date(run.startedAt).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {entry.deadLetters.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-1">
                      {entry.deadLetters.map((deadLetter) => (
                        <li
                          key={deadLetter.id}
                          className="border-[var(--color-danger-500)]/20 flex flex-wrap items-center justify-between gap-2 border-b py-1"
                        >
                          <span className="text-[var(--color-danger-500)]">
                            {deadLetter.failureReason}
                            {deadLetter.providerEventId
                              ? ` · ${deadLetter.providerEventId}`
                              : ""}
                          </span>
                          <span className="text-xs text-[var(--color-stone-500)]">
                            {new Date(
                              deadLetter.firstFailedAt,
                            ).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Reconciliation reports
        </h2>
        <p className="mt-1 text-xs text-[var(--color-stone-500)]">
          Counts of matched, conflicted, stale, and dead-lettered records per
          sync run and resource type.
        </p>
        {lifecycleByConnection.every(
          (entry) => entry.reconciliationReports.length === 0,
        ) ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No reconciliation reports recorded yet.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-4 text-sm">
            {lifecycleByConnection.map((entry) => {
              const connection = connections.find(
                (candidate) => candidate.id === entry.connectionId,
              );
              if (!connection || entry.reconciliationReports.length === 0) {
                return null;
              }
              return (
                <div key={entry.connectionId}>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
                    {connection.displayName}
                  </p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {entry.reconciliationReports.map((report) => (
                      <li
                        key={report.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-stone-100)] py-1"
                      >
                        <span>
                          {report.resource} · matched {report.matchedCount},
                          conflict {report.conflictCount}, stale{" "}
                          {report.staleCount}, dead-letter{" "}
                          {report.deadLetterCount}
                        </span>
                        <span className="text-xs text-[var(--color-stone-500)]">
                          {new Date(report.generatedAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
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
