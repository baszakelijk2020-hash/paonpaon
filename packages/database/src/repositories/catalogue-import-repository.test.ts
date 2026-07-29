import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { CatalogueImportRepository } from "./catalogue-import-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type CatalogueImportRow =
  Database["public"]["Tables"]["catalogue_imports"]["Row"];
type CatalogueImportRowRecord =
  Database["public"]["Tables"]["catalogue_import_rows"]["Row"];
type MetadataReviewTaskRow =
  Database["public"]["Tables"]["metadata_review_tasks"]["Row"];

const retailerId = "11111111-1111-4111-8111-111111111111";
const staffId = "22222222-2222-4222-8222-222222222222";
const importId = "33333333-3333-4333-8333-333333333333";
const rowId = "44444444-4444-4444-8444-444444444444";

const importRow: CatalogueImportRow = {
  id: importId,
  retailer_id: retailerId,
  status: "previewing",
  uploaded_by_staff_id: staffId,
  source_filename: "supplier.csv",
  source_type: "csv",
  row_count: 1,
  contract_version: "v1",
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
  completed_at: null,
  deleted_at: null,
};

const importRowRecord: CatalogueImportRowRecord = {
  id: rowId,
  import_id: importId,
  retailer_id: retailerId,
  row_number: 2,
  external_sku: "LP-SUM-001",
  raw_payload: { external_sku: "LP-SUM-001", name: "Summer hopsack jacket" },
  proposed_product: {
    externalSku: "LP-SUM-001",
    name: "Summer hopsack jacket",
    assetMatches: [],
    categoryMappings: [],
  },
  validation_errors: [],
  status: "valid",
  published_product_id: null,
  published_variant_id: null,
  published_by_staff_id: null,
  published_at: null,
  last_publish_attempt_at: null,
  publish_error: null,
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
};

const reviewTaskRow: MetadataReviewTaskRow = {
  id: "55555555-5555-4555-8555-555555555555",
  retailer_id: retailerId,
  import_row_id: rowId,
  assignment_id: null,
  proposed_concept_id: null,
  proposed_value: "garment_type: overcoat",
  source: "supplier",
  confidence: null,
  status: "pending",
  reviewed_by_staff_id: null,
  reviewed_at: null,
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
};

describe("CatalogueImportRepository", () => {
  it("maps import jobs and keeps an explicit retailer filter", async () => {
    const eq = vi.fn();
    const builder = fakeQueryBuilder({
      data: [importRow],
      error: null,
    });
    builder.eq = (...args: Parameters<typeof eq>) => {
      eq(...args);
      return builder;
    };
    const repository = new CatalogueImportRepository({
      from: () => builder,
    } as unknown as PaonSupabaseClient);

    const imports = await repository.listForRetailer(retailerId as never);

    expect(eq).toHaveBeenCalledWith("retailer_id", retailerId);
    expect(imports).toEqual([
      expect.objectContaining({
        id: importId,
        retailerId,
        sourceType: "csv",
        status: "previewing",
        rowCount: 1,
      }),
    ]);
  });

  it("persists preview rows without published status and maps review tasks", async () => {
    const from = vi.fn((table: string) => {
      if (table === "catalogue_imports") {
        return fakeQueryBuilder({ data: importRow, error: null });
      }
      if (table === "catalogue_import_rows") {
        return fakeQueryBuilder({ data: [importRowRecord], error: null });
      }
      if (table === "metadata_review_tasks") {
        return fakeQueryBuilder({ data: [reviewTaskRow], error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });
    const repository = new CatalogueImportRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const saved = await repository.savePreview({
      retailerId: retailerId as never,
      uploadedByStaffId: staffId,
      sourceFilename: "supplier.csv",
      sourceType: "csv",
      contractVersion: "v1",
      rows: [
        {
          rowNumber: 2,
          externalSku: "LP-SUM-001",
          rawPayload: {
            external_sku: "LP-SUM-001",
            name: "Summer hopsack jacket",
          },
          proposedProduct: {
            externalSku: "LP-SUM-001",
            name: "Summer hopsack jacket",
            assetMatches: [],
            categoryMappings: [],
          },
          validationErrors: [],
          status: "valid",
          reviewTasks: [
            {
              field: "garment_type",
              proposedValue: "overcoat",
              explanation: "No accepted concept",
            },
          ],
        },
      ],
    });

    expect(saved.import.status).toBe("previewing");
    expect(saved.rows[0]?.status).toBe("valid");
    expect(saved.rows[0]?.status).not.toBe("published");
    expect(saved.reviewTasks[0]?.proposedValue).toContain("overcoat");
    expect(from).toHaveBeenCalledWith("catalogue_imports");
    expect(from).toHaveBeenCalledWith("catalogue_import_rows");
    expect(from).toHaveBeenCalledWith("metadata_review_tasks");
  });

  it("refuses to persist published rows from preview", async () => {
    const repository = new CatalogueImportRepository({
      from: () => {
        throw new Error("should not query");
      },
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.savePreview({
        retailerId: retailerId as never,
        uploadedByStaffId: staffId,
        sourceFilename: "supplier.csv",
        sourceType: "csv",
        contractVersion: "v1",
        rows: [
          {
            rowNumber: 2,
            rawPayload: {},
            validationErrors: [],
            status: "published" as "pending",
            reviewTasks: [],
          },
        ],
      }),
    ).rejects.toThrow(/cannot persist published/);
  });

  it("maps publish RPC payloads and review task reloads", async () => {
    const rpc = vi.fn(async (fn: string) => {
      if (fn === "publish_catalogue_import_row") {
        return {
          data: {
            ok: true,
            productId: "66666666-6666-4666-8666-666666666666",
            variantId: "77777777-7777-4777-8777-777777777777",
            outcome: "created",
          },
          error: null,
        };
      }
      if (fn === "review_catalogue_import_task") {
        return { data: reviewTaskRow.id, error: null };
      }
      throw new Error(`unexpected rpc ${fn}`);
    });
    const reviewedTask = {
      ...reviewTaskRow,
      status: "dismissed" as const,
      reviewed_by_staff_id: staffId,
      reviewed_at: "2026-07-30T01:00:00.000Z",
    };
    const repository = new CatalogueImportRepository({
      rpc,
      from: (table: string) => {
        if (table === "metadata_review_tasks") {
          return fakeQueryBuilder({ data: reviewedTask, error: null });
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as PaonSupabaseClient);

    const published = await repository.publishRow(rowId as never);
    expect(rpc).toHaveBeenCalledWith("publish_catalogue_import_row", {
      p_import_row_id: rowId,
    });
    expect(published).toEqual({
      ok: true,
      productId: "66666666-6666-4666-8666-666666666666",
      variantId: "77777777-7777-4777-8777-777777777777",
      outcome: "created",
    });

    const reviewed = await repository.reviewTask(
      reviewTaskRow.id as never,
      "dismissed",
    );
    expect(rpc).toHaveBeenCalledWith("review_catalogue_import_task", {
      p_task_id: reviewTaskRow.id,
      p_status: "dismissed",
    });
    expect(reviewed.status).toBe("dismissed");
    expect(reviewed.reviewedByStaffId).toBe(staffId);
  });

  it("publishes only reviewed valid rows and continues after failures", async () => {
    const secondRowId = "44444444-4444-4444-8444-444444444445";
    const secondRow = {
      ...importRowRecord,
      id: secondRowId,
      row_number: 3,
      external_sku: "LP-SUM-002",
    };
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          ok: false,
          code: "publish_failed",
          error: "forced failure",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          productId: "66666666-6666-4666-8666-666666666666",
          outcome: "created",
        },
        error: null,
      });

    const repository = new CatalogueImportRepository({
      rpc,
      from: (table: string) => {
        if (table === "catalogue_import_rows") {
          return fakeQueryBuilder({
            data: [importRowRecord, secondRow],
            error: null,
          });
        }
        if (table === "metadata_review_tasks") {
          return fakeQueryBuilder({ data: [], error: null });
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as PaonSupabaseClient);

    const batch = await repository.publishReadyRows({
      retailerId: retailerId as never,
      importId: importId as never,
    });

    expect(batch.results).toHaveLength(2);
    expect(batch.results[0]?.result.ok).toBe(false);
    expect(batch.results[1]?.result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("applyEnrichment replaces pending AI review tasks idempotently", async () => {
    const updatedRowRecord = {
      ...importRowRecord,
      proposed_product: {
        externalSku: "LP-SUM-001",
        name: "Summer hopsack jacket",
        climate: "warm",
        assetMatches: [],
        categoryMappings: [],
      },
    };
    const aiTaskRow = {
      ...reviewTaskRow,
      source: "ai" as const,
      confidence: 0.84,
      proposed_value: "climate: warm",
    };

    const from = vi.fn((table: string) => {
      if (table === "catalogue_import_rows") {
        return fakeQueryBuilder({ data: updatedRowRecord, error: null });
      }
      if (table === "metadata_review_tasks") {
        return fakeQueryBuilder({ data: [aiTaskRow], error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const repository = new CatalogueImportRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const result = await repository.applyEnrichment({
      retailerId: retailerId as never,
      importRowId: rowId as never,
      proposedProduct: {
        externalSku: "LP-SUM-001",
        name: "Summer hopsack jacket",
        climate: "warm",
        assetMatches: [],
        categoryMappings: [],
      },
      reviewTasks: [
        {
          field: "climate",
          proposedValue: "warm",
          explanation: "Derived from hopsack weight.",
          confidence: 0.84,
        },
      ],
    });

    expect(result.reviewTasks).toHaveLength(1);
    expect(result.reviewTasks[0]?.source).toBe("ai");
    expect(result.row.proposedProduct?.climate).toBe("warm");
    expect(from).toHaveBeenCalledWith("catalogue_import_rows");
    expect(from).toHaveBeenCalledWith("metadata_review_tasks");
  });
});
