import type {
  CatalogueImportRow,
  CatalogueImportRowStatus,
  MetadataReviewTask,
  MetadataReviewTaskStatus,
} from "./import";
import type { CatalogueImportPublishResultParsed } from "./import.schema";

export type CatalogueImportPublishOutcome =
  "created" | "updated" | "already_published";

export type CatalogueImportPublishErrorCode =
  "invalid_row" | "not_reviewed" | "publish_failed" | "unauthorized";

export type CatalogueImportPublishResult = CatalogueImportPublishResultParsed;

export interface CatalogueImportPublishProgress {
  readonly totalRows: number;
  readonly validRows: number;
  readonly publishedRows: number;
  readonly rejectedRows: number;
  readonly pendingReviewTaskCount: number;
  readonly publishableRowCount: number;
  readonly failedPublishCount: number;
}

/**
 * A row may publish only when it is valid, carries a proposed product, and
 * every import review task has left pending. Unmapped proposals never become
 * accepted assignments; mapped concepts publish as accepted at RPC time.
 */
export function isCatalogueImportRowPublishable(params: {
  readonly row: Pick<
    CatalogueImportRow,
    "status" | "proposedProduct" | "publishError"
  >;
  readonly reviewTasks: readonly Pick<MetadataReviewTask, "status">[];
}): boolean {
  if (params.row.status !== "valid") {
    return false;
  }
  if (params.row.proposedProduct === undefined) {
    return false;
  }
  return params.reviewTasks.every((task) => task.status !== "pending");
}

export function summarizeCatalogueImportPublishProgress(params: {
  readonly rows: readonly Pick<
    CatalogueImportRow,
    "id" | "status" | "proposedProduct" | "publishError"
  >[];
  readonly reviewTasks: readonly Pick<
    MetadataReviewTask,
    "importRowId" | "status"
  >[];
}): CatalogueImportPublishProgress {
  const tasksByRow = new Map<string, MetadataReviewTaskStatus[]>();
  for (const task of params.reviewTasks) {
    if (!task.importRowId) continue;
    const existing = tasksByRow.get(task.importRowId) ?? [];
    existing.push(task.status);
    tasksByRow.set(task.importRowId, existing);
  }

  let validRows = 0;
  let publishedRows = 0;
  let rejectedRows = 0;
  let publishableRowCount = 0;
  let failedPublishCount = 0;
  let pendingReviewTaskCount = 0;

  for (const statuses of tasksByRow.values()) {
    pendingReviewTaskCount += statuses.filter(
      (status) => status === "pending",
    ).length;
  }

  for (const row of params.rows) {
    const status = row.status as CatalogueImportRowStatus;
    if (status === "valid") validRows += 1;
    if (status === "published") publishedRows += 1;
    if (status === "rejected") rejectedRows += 1;
    if (row.publishError) failedPublishCount += 1;

    const taskStatuses = (tasksByRow.get(row.id) ?? []).map((status) => ({
      status,
    }));
    if (
      isCatalogueImportRowPublishable({
        row,
        reviewTasks: taskStatuses,
      })
    ) {
      publishableRowCount += 1;
    }
  }

  return {
    totalRows: params.rows.length,
    validRows,
    publishedRows,
    rejectedRows,
    pendingReviewTaskCount,
    publishableRowCount,
    failedPublishCount,
  };
}
