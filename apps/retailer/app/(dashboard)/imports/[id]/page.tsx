import { requireRetailerRole } from "@paon/auth";
import { CatalogueImportRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { notFound, redirect } from "next/navigation";

import { ImportPreviewTable } from "../import-preview-table";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ImportPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const repo = new CatalogueImportRepository(supabase);
  const importJob = await repo.findById(
    session.retailerId,
    asId<"CatalogueImportId">(id),
  );
  if (!importJob) {
    notFound();
  }

  const [rows, reviewTasks] = await Promise.all([
    repo.findRows(session.retailerId, importJob.id),
    repo.findReviewTasks(session.retailerId, importJob.id),
  ]);

  const validCount = rows.filter((row) => row.status === "valid").length;
  const rejectedCount = rows.filter((row) => row.status === "rejected").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
          Catalogue import
        </p>
        <h1 className="font-display mt-2 text-4xl text-[var(--color-stone-900)]">
          {importJob.sourceFilename}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
          Preview-only import job. Raw supplier values, mapping explanations,
          duplicate checks, and review tasks are retained. Publishing arrives in
          the next queue slice.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{importJob.sourceType.toUpperCase()}</Badge>
        <Badge tone="neutral">Contract {importJob.contractVersion}</Badge>
        <Badge tone="success">{validCount} valid</Badge>
        <Badge tone="danger">{rejectedCount} rejected</Badge>
        <Badge tone="neutral">{reviewTasks.length} review tasks</Badge>
      </div>

      <ImportPreviewTable rows={rows} />

      {reviewTasks.length > 0 ? (
        <section aria-labelledby="review-tasks-heading" className="grid gap-3">
          <h2
            id="review-tasks-heading"
            className="font-display text-2xl text-[var(--color-stone-900)]"
          >
            Pending concept proposals
          </h2>
          <ul className="grid gap-2 text-sm text-[var(--color-stone-600)]">
            {reviewTasks.map((task) => (
              <li key={task.id}>
                {task.proposedKind}: “{task.proposedValue}” ({task.source})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
