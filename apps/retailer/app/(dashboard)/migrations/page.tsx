import { requireRetailerRole } from "@paon/auth";
import { MigrationJobRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createFixtureMigrationJobAction,
  publishMigrationJobAction,
} from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Staged-file migration cockpit (PHASE 9.1). Extends catalogue import and
 * source-authority foundations with dry-run, publish, reconcile, and
 * dead-letter visibility. No silent identity merge.
 */
export default async function MigrationsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const jobs = await new MigrationJobRepository(supabase).listJobs(
    session.retailerId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Migration cockpit
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Staged-file customers, products, stock and orders — dry-run first,
          dependency-ordered publish, reconcile counts and money. Passwords and
          ambiguous identity merges are rejected.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/imports" className="text-sm underline">
            Catalogue imports →
          </Link>
          <Link href="/settings/integrations" className="text-sm underline">
            Source connections →
          </Link>
        </div>
      </div>

      <Card>
        <form action={createFixtureMigrationJobAction}>
          <button
            type="submit"
            className="bg-[var(--color-stone-900)] px-4 py-2 text-sm text-white"
          >
            Load fixture job (dry-run)
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--color-stone-500)]">
          Uses the provider-neutral staged-file fixture. Live provider adapters
          land in 9.2.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Jobs
        </h2>
        {jobs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No migration jobs yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3 text-sm">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="border-b border-[var(--color-stone-100)] py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{job.displayName}</span>
                  <span className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                    {job.status}
                  </span>
                </div>
                {job.dryRunReport ? (
                  <p className="mt-1 text-[var(--color-stone-600)]">
                    Dry-run · customers {job.dryRunReport.counts.customer} ·
                    products {job.dryRunReport.counts.product} · stock{" "}
                    {job.dryRunReport.counts.stock} · orders{" "}
                    {job.dryRunReport.counts.order} · money{" "}
                    {job.dryRunReport.expectedOrderMoneyMinor} · dead-letter{" "}
                    {job.dryRunReport.deadLetter}
                  </p>
                ) : null}
                {job.reconcileReport ? (
                  <p className="mt-1 text-[var(--color-stone-600)]">
                    Reconcile · matched {String(job.reconcileReport.matched)} ·
                    money {job.reconcileReport.orderMoneyMinor} · stock{" "}
                    {job.reconcileReport.stockUnits}
                  </p>
                ) : null}
                {job.rollbackRef ? (
                  <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                    Rollback ref: {job.rollbackRef}
                  </p>
                ) : null}
                {job.status === "dry_run" || job.status === "failed" ? (
                  <form action={publishMigrationJobAction} className="mt-2">
                    <input type="hidden" name="jobId" value={job.id} />
                    <button
                      type="submit"
                      className="border border-[var(--color-stone-300)] px-3 py-1 text-xs"
                    >
                      Publish / resume
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
