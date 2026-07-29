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
});
