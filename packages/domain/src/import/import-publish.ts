import type {
  CatalogueImportProposedProduct,
  CatalogueImportRow,
  CatalogueImportValidationIssue,
  MetadataReviewTask,
} from "./import";

export type CatalogueImportPublishBlockerCode =
  | "row_not_valid"
  | "already_published"
  | "blocking_validation_error"
  | "pending_review_task"
  | "unmapped_category"
  | "missing_proposed_product";

export interface CatalogueImportPublishBlocker {
  readonly code: CatalogueImportPublishBlockerCode;
  readonly message: string;
}

export interface CatalogueImportPublishEligibility {
  readonly eligible: boolean;
  readonly blockers: readonly CatalogueImportPublishBlocker[];
}

export interface CatalogueImportPublishResult {
  readonly productId: string;
  readonly variantId: string;
  readonly idempotent: boolean;
}

function hasBlockingValidationError(
  issues: readonly CatalogueImportValidationIssue[],
): boolean {
  return issues.some((issue) => issue.severity === "error");
}

function hasUnmappedCategory(
  proposedProduct: CatalogueImportProposedProduct,
): boolean {
  return proposedProduct.categoryMappings.some(
    (mapping) =>
      mapping.status !== "mapped" || mapping.mappedConceptId === undefined,
  );
}

function hasPendingReviewTask(tasks: readonly MetadataReviewTask[]): boolean {
  return tasks.some((task) => task.status === "pending");
}

/**
 * Pure publish gate used by the repository and Retailer Portal before calling
 * the transactional database RPC.
 */
export function assessCatalogueImportRowPublishEligibility(params: {
  readonly row: CatalogueImportRow;
  readonly reviewTasks: readonly MetadataReviewTask[];
}): CatalogueImportPublishEligibility {
  const blockers: CatalogueImportPublishBlocker[] = [];

  if (params.row.status === "published") {
    return { eligible: true, blockers: [] };
  }

  if (params.row.status !== "valid") {
    blockers.push({
      code: "row_not_valid",
      message: "Only valid import rows can be published.",
    });
  }

  if (hasBlockingValidationError(params.row.validationErrors)) {
    blockers.push({
      code: "blocking_validation_error",
      message: "Resolve blocking validation errors before publishing.",
    });
  }

  if (hasPendingReviewTask(params.reviewTasks)) {
    blockers.push({
      code: "pending_review_task",
      message: "Accept, reject, or dismiss every metadata review task first.",
    });
  }

  if (params.row.proposedProduct === undefined) {
    blockers.push({
      code: "missing_proposed_product",
      message: "This row has no normalized product payload to publish.",
    });
  } else if (hasUnmappedCategory(params.row.proposedProduct)) {
    blockers.push({
      code: "unmapped_category",
      message:
        "Every supplier category value must map to an accepted concept before publish.",
    });
  }

  return {
    eligible: blockers.length === 0,
    blockers,
  };
}

export function summarizeImportPublishProgress(params: {
  readonly rows: readonly CatalogueImportRow[];
}): {
  readonly publishedCount: number;
  readonly publishableCount: number;
  readonly blockedCount: number;
} {
  let publishedCount = 0;
  let publishableCount = 0;
  let blockedCount = 0;

  for (const row of params.rows) {
    if (row.status === "published") {
      publishedCount += 1;
      continue;
    }
    if (row.status === "valid") {
      publishableCount += 1;
      continue;
    }
    blockedCount += 1;
  }

  return { publishedCount, publishableCount, blockedCount };
}
