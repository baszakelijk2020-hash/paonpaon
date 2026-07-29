import {
  asId,
  type CatalogueImport,
  type CatalogueImportId,
  type CatalogueImportRow,
  type CatalogueImportRowStatus,
  type CatalogueImportSourceType,
  type CatalogueImportStatus,
  type ImportPreviewRow,
  type ImportProposedProduct,
  type ImportValidationIssue,
  type MetadataReviewTask,
  type MetadataReviewTaskStatus,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type CatalogueImportRowDb =
  Database["public"]["Tables"]["catalogue_imports"]["Row"];
type CatalogueImportDataRowDb =
  Database["public"]["Tables"]["catalogue_import_rows"]["Row"];
type MetadataReviewTaskRowDb =
  Database["public"]["Tables"]["metadata_review_tasks"]["Row"];

function toJsonObject(value: Readonly<Record<string, string>>): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function fromJsonObject(value: Json): Readonly<Record<string, string>> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Import raw payload must be a JSON object");
  }
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = String(entry ?? "");
  }
  return result;
}

function toValidationIssues(value: Json): readonly ImportValidationIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const field = "field" in entry ? String(entry.field) : "";
    const code = "code" in entry ? String(entry.code) : "";
    const message = "message" in entry ? String(entry.message) : "";
    if (!field || !code || !message) {
      return [];
    }
    return [{ field, code, message }];
  });
}

function toProposedProduct(value: Json | null): ImportProposedProduct | null {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return null;
  }
  return value as unknown as ImportProposedProduct;
}

function toImport(row: CatalogueImportRowDb): CatalogueImport {
  return {
    id: asId<"CatalogueImportId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    status: row.status,
    uploadedByStaffId: asId<"StaffId">(row.uploaded_by_staff_id),
    sourceFilename: row.source_filename,
    sourceType: row.source_type,
    contractVersion: row.contract_version,
    rowCount: row.row_count,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function toImportRow(row: CatalogueImportDataRowDb): CatalogueImportRow {
  return {
    id: asId<"CatalogueImportRowId">(row.id),
    importId: asId<"CatalogueImportId">(row.import_id),
    rowNumber: row.row_number,
    externalSku: row.external_sku,
    rawPayload: fromJsonObject(row.raw_payload),
    proposedProduct: toProposedProduct(row.proposed_product),
    validationErrors: toValidationIssues(row.validation_errors),
    status: row.status,
  };
}

function toReviewTask(row: MetadataReviewTaskRowDb): MetadataReviewTask {
  return {
    id: asId<"MetadataReviewTaskId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    importRowId:
      row.import_row_id === null
        ? null
        : asId<"CatalogueImportRowId">(row.import_row_id),
    assignmentId:
      row.assignment_id === null
        ? null
        : asId<"EntityMetadataAssignmentId">(row.assignment_id),
    proposedConceptId:
      row.proposed_concept_id === null
        ? null
        : asId<"MetadataConceptId">(row.proposed_concept_id),
    proposedKind: row.proposed_kind,
    proposedValue: row.proposed_value,
    source: row.source,
    confidence: row.confidence,
    status: row.status,
    reviewedByStaffId:
      row.reviewed_by_staff_id === null
        ? null
        : asId<"StaffId">(row.reviewed_by_staff_id),
    reviewedAt: row.reviewed_at,
  };
}

export interface CreateCatalogueImportPreviewParams {
  retailerId: RetailerId;
  uploadedByStaffId: StaffId;
  sourceFilename: string;
  sourceType: CatalogueImportSourceType;
  contractVersion: string;
  rows: readonly ImportPreviewRow[];
}

export class CatalogueImportRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByRetailer(retailerId: RetailerId): Promise<CatalogueImport[]> {
    const { data, error } = await this.client
      .from("catalogue_imports")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(toImport);
  }

  async findById(
    retailerId: RetailerId,
    importId: CatalogueImportId,
  ): Promise<CatalogueImport | null> {
    const { data, error } = await this.client
      .from("catalogue_imports")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("id", importId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toImport(data) : null;
  }

  async findRows(
    retailerId: RetailerId,
    importId: CatalogueImportId,
  ): Promise<CatalogueImportRow[]> {
    const { data, error } = await this.client
      .from("catalogue_import_rows")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("import_id", importId)
      .order("row_number", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(toImportRow);
  }

  async findReviewTasks(
    retailerId: RetailerId,
    importId: CatalogueImportId,
  ): Promise<MetadataReviewTask[]> {
    const { data: rows, error: rowsError } = await this.client
      .from("catalogue_import_rows")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("import_id", importId);

    if (rowsError) {
      throw rowsError;
    }

    const rowIds = rows.map((row) => row.id);
    if (rowIds.length === 0) {
      return [];
    }

    const { data, error } = await this.client
      .from("metadata_review_tasks")
      .select("*")
      .eq("retailer_id", retailerId)
      .in("import_row_id", rowIds)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(toReviewTask);
  }

  async createPreview(
    params: CreateCatalogueImportPreviewParams,
  ): Promise<CatalogueImport> {
    const status: CatalogueImportStatus = "preview";
    const { data: importJob, error: importError } = await this.client
      .from("catalogue_imports")
      .insert({
        retailer_id: params.retailerId,
        uploaded_by_staff_id: params.uploadedByStaffId,
        source_filename: params.sourceFilename,
        source_type: params.sourceType,
        contract_version: params.contractVersion,
        row_count: params.rows.length,
        status,
      })
      .select("*")
      .single();

    if (importError) {
      throw importError;
    }

    const importId = asId<"CatalogueImportId">(importJob.id);
    const rowInserts = params.rows.map((row) => ({
      import_id: importId,
      retailer_id: params.retailerId,
      row_number: row.rowNumber,
      external_sku: row.externalSku || `row-${row.rowNumber}`,
      raw_payload: toJsonObject(row.rawPayload),
      proposed_product: row.proposedProduct
        ? (JSON.parse(JSON.stringify(row.proposedProduct)) as Json)
        : null,
      validation_errors: JSON.parse(
        JSON.stringify(row.validationErrors),
      ) as Json,
      status: row.status as CatalogueImportRowStatus,
    }));

    if (rowInserts.length > 0) {
      const { data: insertedRows, error: rowError } = await this.client
        .from("catalogue_import_rows")
        .insert(rowInserts)
        .select("id, row_number");

      if (rowError) {
        throw rowError;
      }

      const rowIdByNumber = new Map(
        insertedRows.map((row) => [row.row_number, row.id]),
      );

      const taskInserts = params.rows.flatMap((row) => {
        const importRowId = rowIdByNumber.get(row.rowNumber);
        if (!importRowId) {
          return [];
        }
        return row.reviewTasks.map((task) => ({
          retailer_id: params.retailerId,
          import_row_id: importRowId,
          proposed_kind: task.proposedKind,
          proposed_value: task.proposedValue,
          source: task.source,
          status: "pending" as MetadataReviewTaskStatus,
        }));
      });

      if (taskInserts.length > 0) {
        const { error: taskError } = await this.client
          .from("metadata_review_tasks")
          .insert(taskInserts);

        if (taskError) {
          throw taskError;
        }
      }
    }

    return toImport(importJob);
  }

  async listExistingSkus(retailerId: RetailerId): Promise<Set<string>> {
    const { data, error } = await this.client
      .from("product_variants")
      .select("sku, products!inner(retailer_id, deleted_at)")
      .eq("products.retailer_id", retailerId)
      .is("products.deleted_at", null)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    return new Set(data.map((row) => row.sku));
  }

  async listExistingSlugs(retailerId: RetailerId): Promise<Set<string>> {
    const { data, error } = await this.client
      .from("products")
      .select("slug")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    return new Set(data.map((row) => row.slug));
  }
}
