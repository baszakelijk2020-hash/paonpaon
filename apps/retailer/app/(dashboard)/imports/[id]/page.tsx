import { requireRetailerRole } from "@paon/auth";
import { CatalogueImportRepository } from "@paon/database";
import {
  asId,
  isCatalogueImportRowPublishable,
  summarizeCatalogueImportPublishProgress,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  EnrichImportButton,
  PublishReadyRowsButton,
  PublishRowButton,
  ReviewTaskActions,
} from "../import-publish-actions";

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

  const progress = summarizeCatalogueImportPublishProgress({
    rows,
    reviewTasks,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
            Catalogue import
          </p>
          <h1 className="font-display mt-2 text-4xl text-[var(--color-stone-900)]">
            {job.sourceFilename}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
            Review metadata proposals, then publish valid reviewed rows
            transactionally. Failures keep the source row and can be retried
            without unreviewed bulk publish.
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
        <Badge>{progress.publishableRowCount} ready to publish</Badge>
        <Badge>{progress.publishedRows} published</Badge>
        {progress.failedPublishCount > 0 ? (
          <Badge tone="danger">
            {progress.failedPublishCount} publish error
            {progress.failedPublishCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </div>

      <Card className="grid gap-3 p-5">
        <div>
          <h2 className="font-display text-2xl text-[var(--color-stone-900)]">
            Publishing status
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            {progress.pendingReviewTaskCount} pending review task
            {progress.pendingReviewTaskCount === 1 ? "" : "s"}. Only valid rows
            with every task resolved can publish. AI enrichment proposes pending
            review tasks only — never auto-accepts.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <EnrichImportButton importId={job.id} />
          <PublishReadyRowsButton
            importId={job.id}
            disabled={progress.publishableRowCount === 0}
            label={`Publish ${progress.publishableRowCount} reviewed row${
              progress.publishableRowCount === 1 ? "" : "s"
            }`}
          />
        </div>
      </Card>

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
            const publishable = isCatalogueImportRowPublishable({
              row,
              reviewTasks: tasks,
            });
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
                  <Badge
                    tone={
                      row.status === "published"
                        ? "success"
                        : row.status === "valid"
                          ? "success"
                          : "warning"
                    }
                  >
                    {row.status}
                  </Badge>
                </div>

                {row.publishError ? (
                  <p
                    role="alert"
                    className="text-sm text-[var(--color-danger-500)]"
                  >
                    Last publish error: {row.publishError}
                  </p>
                ) : null}

                {row.publishedProductId ? (
                  <p className="text-sm text-[var(--color-stone-500)]">
                    Published product{" "}
                    <Link
                      className="underline"
                      href={`/products/${row.publishedProductId}`}
                    >
                      {row.publishedProductId}
                    </Link>
                  </p>
                ) : null}

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
                    <ul className="mt-2 grid gap-3 text-sm">
                      {tasks.map((task) => (
                        <li key={task.id} className="grid gap-2">
                          <div>
                            <Badge
                              tone={
                                task.status === "pending"
                                  ? "warning"
                                  : "success"
                              }
                            >
                              {task.status}
                            </Badge>{" "}
                            <Badge>
                              {task.source}
                              {task.confidence !== undefined
                                ? ` · ${task.confidence}`
                                : ""}
                            </Badge>{" "}
                            {task.proposedValue}
                            {task.evidence ? (
                              <p className="mt-1 text-[var(--color-stone-500)]">
                                Evidence: {task.evidence}
                              </p>
                            ) : null}
                          </div>
                          {task.status === "pending" ? (
                            <ReviewTaskActions
                              importId={job.id}
                              taskId={task.id}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {row.status !== "published" ? (
                  <PublishRowButton
                    importId={job.id}
                    importRowId={row.id}
                    disabled={!publishable}
                  />
                ) : null}

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
    </div>
  );
}
