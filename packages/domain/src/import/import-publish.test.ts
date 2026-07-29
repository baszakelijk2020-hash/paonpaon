import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import type {
  CatalogueImportProposedProduct,
  CatalogueImportRow,
  MetadataReviewTask,
} from "./import";
import {
  assessCatalogueImportRowPublishEligibility,
  summarizeImportPublishProgress,
} from "./import-publish";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const importId = asId<"CatalogueImportId">(
  "33333333-3333-4333-8333-333333333333",
);
const rowId = asId<"CatalogueImportRowId">(
  "44444444-4444-4444-8444-444444444444",
);

function baseProposedProduct(): CatalogueImportProposedProduct {
  return {
    externalSku: "LP-SUM-001",
    name: "Summer hopsack jacket",
    assetMatches: [],
    categoryMappings: [
      {
        rawValue: "jacket",
        mappedConceptId: asId<"MetadataConceptId">(
          "66666666-6666-4666-8666-666666666666",
        ),
        mappedConceptSlug: "jacket",
        status: "mapped",
        explanation: "Mapped supplier jacket.",
      },
    ],
  };
}

function baseRow(
  overrides: Partial<CatalogueImportRow> = {},
): CatalogueImportRow {
  return {
    id: rowId,
    importId,
    retailerId,
    rowNumber: 2,
    externalSku: "LP-SUM-001",
    rawPayload: { external_sku: "LP-SUM-001" },
    proposedProduct: baseProposedProduct(),
    validationErrors: [],
    status: "valid",
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

function baseTask(
  overrides: Partial<MetadataReviewTask> = {},
): MetadataReviewTask {
  return {
    id: asId<"MetadataReviewTaskId">("55555555-5555-4555-8555-555555555555"),
    retailerId,
    importRowId: rowId,
    proposedValue: "garment_type: jacket",
    source: "supplier",
    status: "accepted",
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("assessCatalogueImportRowPublishEligibility", () => {
  it("allows publish when the row is valid, mapped, and review tasks are resolved", () => {
    const result = assessCatalogueImportRowPublishEligibility({
      row: baseRow(),
      reviewTasks: [baseTask()],
    });
    expect(result.eligible).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("treats published rows as idempotently eligible", () => {
    const result = assessCatalogueImportRowPublishEligibility({
      row: baseRow({ status: "published" }),
      reviewTasks: [baseTask({ status: "pending" })],
    });
    expect(result.eligible).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("blocks pending rows, validation errors, pending tasks, and unmapped categories", () => {
    const pending = assessCatalogueImportRowPublishEligibility({
      row: baseRow({ status: "pending" }),
      reviewTasks: [],
    });
    expect(pending.eligible).toBe(false);
    expect(pending.blockers.map((blocker) => blocker.code)).toContain(
      "row_not_valid",
    );

    const validation = assessCatalogueImportRowPublishEligibility({
      row: baseRow({
        validationErrors: [
          {
            code: "missing_required",
            severity: "error",
            message: "Missing SKU",
            explanation: "Required.",
          },
        ],
      }),
      reviewTasks: [],
    });
    expect(validation.blockers.map((blocker) => blocker.code)).toContain(
      "blocking_validation_error",
    );

    const review = assessCatalogueImportRowPublishEligibility({
      row: baseRow(),
      reviewTasks: [baseTask({ status: "pending" })],
    });
    expect(review.blockers.map((blocker) => blocker.code)).toContain(
      "pending_review_task",
    );

    const unmapped = assessCatalogueImportRowPublishEligibility({
      row: baseRow({
        proposedProduct: {
          ...baseProposedProduct(),
          categoryMappings: [
            {
              rawValue: "overcoat",
              status: "proposed",
              explanation: "Needs review.",
            },
          ],
        },
      }),
      reviewTasks: [baseTask({ status: "dismissed" })],
    });
    expect(unmapped.blockers.map((blocker) => blocker.code)).toContain(
      "unmapped_category",
    );
  });
});

describe("summarizeImportPublishProgress", () => {
  it("counts published, publishable, and blocked rows", () => {
    expect(
      summarizeImportPublishProgress({
        rows: [
          baseRow({ status: "published" }),
          baseRow({ id: asId("77777777-7777-4777-8777-777777777777") }),
          baseRow({
            id: asId("88888888-8888-4888-8888-888888888888"),
            status: "pending",
          }),
        ],
      }),
    ).toEqual({
      publishedCount: 1,
      publishableCount: 1,
      blockedCount: 1,
    });
  });
});
