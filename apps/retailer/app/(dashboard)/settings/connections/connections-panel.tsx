"use client";

import type { RetailerConnectionOverview } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import { runFadenFixtureIngest, type ConnectionsActionState } from "./actions";

const initial: ConnectionsActionState = {};

function healthTone(
  status: RetailerConnectionOverview["summarizedStatus"],
): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "healthy":
      return "success";
    case "degraded":
      return "warning";
    case "failed":
    case "stale":
      return "danger";
    default:
      return "neutral";
  }
}

export function ConnectionsPanel({
  overview,
}: {
  overview: readonly RetailerConnectionOverview[];
}) {
  const [state, action, pending] = useActionState(
    runFadenFixtureIngest,
    initial,
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Faden fixture
          </h2>
          <p className="text-sm text-[var(--color-stone-600)]">
            Read-only ingest stores an immutable snapshot and maps the external
            production order id. Outbound actions deep-link to Faden — PAON
            never fakes write-back.
          </p>
        </div>
        <form action={action}>
          <Button type="submit" disabled={pending}>
            {pending ? "Running fixture…" : "Run Faden read-only ingest"}
          </Button>
        </form>
        {state.message ? (
          <p
            className={`text-sm ${state.ok ? "text-[var(--color-success-700)]" : "text-[var(--color-warning-700)]"}`}
          >
            {state.message}
          </p>
        ) : null}
        {state.deepLinkUrl ? (
          <a
            href={state.deepLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--color-accent-700)] underline"
          >
            Open order in Faden (external handoff)
          </a>
        ) : null}
      </Card>

      {overview.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            No connections yet. The fixture creates a Faden connection on first
            run.
          </p>
        </Card>
      ) : (
        overview.map((entry) => (
          <Card key={entry.connection.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-medium text-[var(--color-stone-900)]">
                {entry.connection.label}
              </h3>
              <Badge tone="neutral">{entry.connection.provider}</Badge>
              <Badge tone={healthTone(entry.summarizedStatus)}>
                {entry.summarizedStatus}
              </Badge>
              {entry.connection.status === "fixture" ? (
                <Badge tone="warning">Fixture mode — no live credentials</Badge>
              ) : null}
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--color-stone-500)]">
                  Mapping version
                </dt>
                <dd>{entry.connection.mappingVersion}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-stone-500)]">
                  Allowed directions
                </dt>
                <dd>{entry.connection.allowedDirections.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-stone-500)]">Last sync</dt>
                <dd>{entry.connection.lastSyncAt ?? "Not yet synced"}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-stone-500)]">
                  Open conflicts
                </dt>
                <dd>{entry.openConflicts.length}</dd>
              </div>
            </dl>
            {entry.openConflicts.length > 0 ? (
              <ul className="text-sm text-[var(--color-warning-700)]">
                {entry.openConflicts.map((conflict) => (
                  <li key={conflict.id}>
                    {conflict.conflictReason ?? "Conflict requires review"}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        ))
      )}
    </div>
  );
}
