import { requireRetailerRole } from "@paon/auth";
import { CatalogueImportRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
  const repository = new CatalogueImportRepository(
    await getSupabaseServerClient(),
  );
  const importId = asId<"CatalogueImportId">(id);
  const job = await repository.findById(session.retailerId, importId);
  if (!job) notFound();

  const [rows, reviewTasks] = await Promise.all([
    repository.findRows(session.retailerId, importId),
    repository.findReviewTasksForImport(session.retailerId, importId),
  ]);

  const tasksByRowId = new Map<string, typeof reviewTasks>();
  for (const task of reviewTasks) {
    if (!task.importRowId) continue;
    const existing = tasksByRowId.get(task.importRowId) ?? [];
    tasksByRowId.set(task.importRowId, [...existing, task]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
            Catalogue import preview
          </p>
          <h1 className="font-display mt-2 text-4xl text-[var(--color-stone-900)]">
            {job.sourceFilename}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
            Raw supplier values are preserved. Category mappings, asset matches,
            validation, and duplicates are explained below. No row is published
            from preview.
          </p>
        </div>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href="/imports"
        >
          Back to imports
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="status">
        <Badge tone="warning">{job.status}</Badge>
        <Badge>{job.sourceType.toUpperCase()}</Badge>
        <Badge>contract {job.contractVersion}</Badge>
        <Badge>
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </Badge>
        <Badge>
          {reviewTasks.length} review task
          {reviewTasks.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {rows.length === 0 ? (
        <Card className="border-dashed py-14 text-center">
          <p className="font-display text-2xl">No rows in this preview.</p>
          <p className="mt-2 text-sm text-[var(--color-stone-500)]">
            Re-upload a file that includes at least one data row under the PAON
            header contract.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((row) => {
            const issues = row.validationErrors;
            const errors = issues.filter((issue) => issue.severity === "error");
            const warnings = issues.filter(
              (issue) => issue.severity !== "error",
            );
            const tasks = tasksByRowId.get(row.id) ?? [];
            return (
              <Card key={row.id} className="grid gap-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--color-stone-900)]">
                      Row {row.rowNumber}
                      {row.externalSku ? ` · ${row.externalSku}` : ""}
                    </p>
                    <p className="text-sm text-[var(--color-stone-500)]">
                      {row.proposedProduct?.name ?? "Unparsed product name"}
                    </p>
                  </div>
                  <Badge tone={row.status === "valid" ? "success" : "warning"}>
                    {row.status}
                  </Badge>
                </div>

                {row.proposedProduct ? (
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[var(--color-stone-500)]">
                        Supplier reference
                      </dt>
                      <dd>{row.proposedProduct.supplierReference ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-stone-500)]">
                        Proposed slug
                      </dt>
                      <dd>{row.proposedProduct.proposedSlug ?? "—"}</dd>
                    </div>
                  </dl>
                ) : null}

                <section aria-label={`Asset matches for row ${row.rowNumber}`}>
                  <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                    Asset matching
                  </h3>
                  <ul className="mt-2 grid gap-2 text-sm">
                    {(row.proposedProduct?.assetMatches ?? []).map((asset) => (
                      <li key={`${row.id}-${asset.role}`}>
                        <span className="font-medium">{asset.role}</span>:{" "}
                        {asset.matchReason}
                      </li>
                    ))}
                    {(row.proposedProduct?.assetMatches ?? []).length === 0 ? (
                      <li className="text-[var(--color-stone-500)]">
                        No asset URLs available on this row.
                      </li>
                    ) : null}
                  </ul>
                </section>

                <section
                  aria-label={`Category mappings for row ${row.rowNumber}`}
                >
                  <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                    Category mapping
                  </h3>
                  <ul className="mt-2 grid gap-2 text-sm">
                    {(row.proposedProduct?.categoryMappings ?? []).map(
                      (mapping) => (
                        <li
                          key={`${row.id}-${mapping.rawValue}-${mapping.explanation}`}
                        >
                          <Badge
                            tone={
                              mapping.status === "mapped"
                                ? "success"
                                : "warning"
                            }
                          >
                            {mapping.status}
                          </Badge>{" "}
                          {mapping.explanation}
                        </li>
                      ),
                    )}
                    {(row.proposedProduct?.categoryMappings ?? []).length ===
                    0 ? (
                      <li className="text-[var(--color-stone-500)]">
                        No category fields present on this row.
                      </li>
                    ) : null}
                  </ul>
                </section>

                <section aria-label={`Validation for row ${row.rowNumber}`}>
                  <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                    Validation and duplicates
                  </h3>
                  {issues.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                      No validation issues.
                    </p>
                  ) : (
                    <ul className="mt-2 grid gap-2 text-sm">
                      {errors.map((issue) => (
                        <li
                          key={`${row.id}-e-${issue.code}-${issue.field ?? ""}-${issue.message}`}
                          role="alert"
                          className="text-[var(--color-danger-500)]"
                        >
                          {issue.message}: {issue.explanation}
                        </li>
                      ))}
                      {warnings.map((issue) => (
                        <li
                          key={`${row.id}-w-${issue.code}-${issue.field ?? ""}-${issue.message}`}
                        >
                          {issue.message}: {issue.explanation}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-label={`Review tasks for row ${row.rowNumber}`}>
                  <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                    Review tasks
                  </h3>
                  {tasks.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                      No metadata review tasks for this row.
                    </p>
                  ) : (
                    <ul className="mt-2 grid gap-2 text-sm">
                      {tasks.map((task) => (
                        <li key={task.id}>
                          <Badge tone="warning">{task.status}</Badge>{" "}
                          {task.proposedValue}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <details>
                  <summary className="cursor-pointer text-sm text-[var(--color-stone-700)]">
                    Raw supplier payload
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-[var(--color-stone-100)] p-3 text-xs">
                    {JSON.stringify(row.rawPayload, null, 2)}
                  </pre>
                </details>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-dashed p-4 text-sm text-[var(--color-stone-500)]">
        Publishing reviewed rows is reserved for a later queue item. This
        preview retains source identifiers and never creates catalogue products.
      </Card>
    </div>
  );
}
