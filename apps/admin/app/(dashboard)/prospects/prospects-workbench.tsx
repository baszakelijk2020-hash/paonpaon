"use client";

import { SearchableCollection } from "@paon/ui/components/SearchableCollection";
import { demoEnvironmentLabel } from "@paon/utils";
import Link from "next/link";
import { useActionState } from "react";

import { updateProspectStage } from "./actions";

const STAGE_LABELS = {
  researched: "Research",
  qualified: "Qualified",
  demo_preparation: "Demo in preparation",
  demo_ready: "Demo ready",
  demo_sent: "Demo sent",
  consultation: "Consultation",
  proposal: "Proposal",
  pilot: "Paid pilot",
  converted: "Converted",
  lost: "Closed",
} as const;

export type ProspectWorkbenchRow = {
  id: string;
  companyName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  stage: keyof typeof STAGE_LABELS;
  nextAction: string | null;
  demoStatus: string | null;
  retailerSlug: string | null;
  storefrontHref: string | null;
  privateDemoHref: string | null;
};

function ProspectStageCard({ prospect }: { prospect: ProspectWorkbenchRow }) {
  const [state, action, pending] = useActionState(updateProspectStage, {});

  return (
    <form action={action} className="mt-4 flex flex-col gap-2 border-t pt-4">
      <input type="hidden" name="prospectId" value={prospect.id} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`stage-${prospect.id}`}>
          Pipeline stage
        </label>
        <select
          id={`stage-${prospect.id}`}
          name="stage"
          defaultValue={prospect.stage}
          disabled={pending}
          className="h-9 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-2 text-xs disabled:opacity-50"
        >
          {Object.entries(STAGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-3 text-xs text-white disabled:opacity-50"
        >
          {pending ? "Updating…" : "Update stage"}
        </button>
      </div>
      {state.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-xs text-[var(--color-success-500)]">
          Stage updated.
        </p>
      ) : null}
    </form>
  );
}

export function ProspectsWorkbench({ rows }: { rows: ProspectWorkbenchRow[] }) {
  return (
    <SearchableCollection
      items={rows}
      placeholder="Search company or contact…"
      label="Search prospects"
      predicate={(row, query) =>
        row.companyName.toLowerCase().includes(query) ||
        row.primaryContactName.toLowerCase().includes(query) ||
        row.primaryContactEmail.toLowerCase().includes(query) ||
        (row.retailerSlug?.toLowerCase().includes(query) ?? false)
      }
      empty={
        <p className="text-sm text-[var(--color-stone-500)]">
          No prospects match that search.
        </p>
      }
    >
      {(filtered) => (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((prospect) => (
            <article
              key={prospect.id}
              className="rounded-[var(--radius-md)] border bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lifted)]"
            >
              <Link href={`/prospects/${prospect.id}/studio`} className="block">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {STAGE_LABELS[prospect.stage]}
                      {prospect.demoStatus
                        ? ` · ${demoEnvironmentLabel(prospect.demoStatus)}`
                        : ""}
                    </p>
                    <h3 className="font-display mt-2 text-3xl">
                      {prospect.companyName}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                      {prospect.primaryContactName} ·{" "}
                      {prospect.primaryContactEmail}
                    </p>
                  </div>
                  <span className="text-xl">→</span>
                </div>
                <div className="mt-6 border-t pt-4">
                  <p className="text-xs text-[var(--color-stone-500)]">
                    Next action
                  </p>
                  <p className="mt-1 text-sm">
                    {prospect.nextAction ?? "Define the next commercial action"}
                  </p>
                </div>
              </Link>
              <ProspectStageCard prospect={prospect} />
              {prospect.retailerSlug || prospect.privateDemoHref ? (
                <div className="mt-4 flex flex-wrap gap-3 border-t pt-4 text-xs">
                  {prospect.storefrontHref ? (
                    <a
                      href={prospect.storefrontHref}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4"
                    >
                      /r/{prospect.retailerSlug}
                    </a>
                  ) : null}
                  {prospect.privateDemoHref ? (
                    <a
                      href={prospect.privateDemoHref}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4"
                    >
                      Private demo
                    </a>
                  ) : null}
                  <Link
                    href={`/prospects/${prospect.id}/studio`}
                    className="underline underline-offset-4"
                  >
                    Open Studio
                  </Link>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </SearchableCollection>
  );
}
