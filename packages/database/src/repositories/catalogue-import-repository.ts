import {
  asId,
  assessCatalogueImportRowPublishEligibility,
  catalogueImportProposedProductSchema,
  catalogueImportValidationIssueSchema,
  type CatalogueImport,
  type CatalogueImportExistingCatalogue,
  type CatalogueImportId,
  type CatalogueImportProposedProduct,
  type CatalogueImportPublishResult,
  type CatalogueImportRow,
  type CatalogueImportRowId,
  type CatalogueImportRowStatus,
  type CatalogueImportSourceType,
  type CatalogueImportStatus,
  type CatalogueImportValidationIssue,
  type MetadataReviewTask,
  type MetadataReviewTaskId,
  type MetadataReviewTaskStatus,
  type ProductId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type CatalogueImportRowDb =
  Database["public"]["Tables"]["catalogue_imports"]["Row"];
type CatalogueImportRowRecord =
  Database["public"]["Tables"]["catalogue_import_rows"]["Row"];
type MetadataReviewTaskRow =
  Database["public"]["Tables"]["metadata_review_tasks"]["Row"];

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function toRawPayload(value: Json): Readonly<Record<string, unknown>> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Import raw payload must be a JSON object");
  }
  return value;
}

function toProposedProduct(
  value: Json | null,
): CatalogueImportProposedProduct | undefined {
  if (value === null) {
    return undefined;
  }
  const parsed = catalogueImportProposedProductSchema.parse(value);
  return {
    externalSku: parsed.externalSku,
    name: parsed.name,
    ...(parsed.description === undefined
      ? {}
      : { description: parsed.description }),
    ...(parsed.garmentType === undefined
      ? {}
      : { garmentType: parsed.garmentType }),
    ...(parsed.priceAmountMinorUnits === undefined
      ? {}
      : { priceAmountMinorUnits: parsed.priceAmountMinorUnits }),
    ...(parsed.currency === undefined ? {} : { currency: parsed.currency }),
    ...(parsed.primaryImageUrl === undefined
      ? {}
      : { primaryImageUrl: parsed.primaryImageUrl }),
    ...(parsed.swatchImageUrl === undefined
      ? {}
      : { swatchImageUrl: parsed.swatchImageUrl }),
    ...(parsed.mill === undefined ? {} : { mill: parsed.mill }),
    ...(parsed.collection === undefined
      ? {}
      : { collection: parsed.collection }),
    ...(parsed.composition === undefined
      ? {}
      : { composition: parsed.composition }),
    ...(parsed.weightGsm === undefined ? {} : { weightGsm: parsed.weightGsm }),
    ...(parsed.season === undefined ? {} : { season: parsed.season }),
    ...(parsed.colour === undefined ? {} : { colour: parsed.colour }),
    ...(parsed.supplierReference === undefined
      ? {}
      : { supplierReference: parsed.supplierReference }),
    ...(parsed.weave === undefined ? {} : { weave: parsed.weave }),
    ...(parsed.pattern === undefined ? {} : { pattern: parsed.pattern }),
    ...(parsed.construction === undefined
      ? {}
      : { construction: parsed.construction }),
    ...(parsed.fit === undefined ? {} : { fit: parsed.fit }),
    ...(parsed.formality === undefined ? {} : { formality: parsed.formality }),
    ...(parsed.occasion === undefined ? {} : { occasion: parsed.occasion }),
    ...(parsed.climate === undefined ? {} : { climate: parsed.climate }),
    ...(parsed.performance === undefined
      ? {}
      : { performance: parsed.performance }),
    ...(parsed.care === undefined ? {} : { care: parsed.care }),
    ...(parsed.proposedSlug === undefined
      ? {}
      : { proposedSlug: parsed.proposedSlug }),
    assetMatches: parsed.assetMatches.map((asset) => ({
      role: asset.role,
      matched: asset.matched,
      matchReason: asset.matchReason,
      ...(asset.sourceUrl === undefined ? {} : { sourceUrl: asset.sourceUrl }),
    })),
    categoryMappings: parsed.categoryMappings.map((mapping) => ({
      rawValue: mapping.rawValue,
      status: mapping.status,
      explanation: mapping.explanation,
      ...(mapping.mappedConceptSlug === undefined
        ? {}
        : { mappedConceptSlug: mapping.mappedConceptSlug }),
      ...(mapping.mappedConceptId === undefined
        ? {}
        : {
            mappedConceptId: asId<"MetadataConceptId">(mapping.mappedConceptId),
          }),
    })),
  };
}

function toValidationErrors(
  value: Json,
): readonly CatalogueImportValidationIssue[] {
  if (!Array.isArray(value)) {
    throw new Error("Import validation errors must be a JSON array");
  }
  return value.map((item) => {
    const parsed = catalogueImportValidationIssueSchema.parse(item);
    return {
      code: parsed.code,
      severity: parsed.severity,
      message: parsed.message,
      explanation: parsed.explanation,
      ...(parsed.field === undefined ? {} : { field: parsed.field }),
    };
  });
}

function toImport(row: CatalogueImportRowDb): CatalogueImport {
  return {
    id: asId<"CatalogueImportId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    status: row.status,
    uploadedByStaffId: asId<"StaffId">(row.uploaded_by_staff_id),
    sourceFilename: row.source_filename,
    sourceType: row.source_type,
    rowCount: row.row_count,
    contractVersion: row.contract_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
  };
}

function toImportRow(row: CatalogueImportRowRecord): CatalogueImportRow {
  const proposedProduct = toProposedProduct(row.proposed_product);
  return {
    id: asId<"CatalogueImportRowId">(row.id),
    importId: asId<"CatalogueImportId">(row.import_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    rowNumber: row.row_number,
    ...(row.external_sku === null ? {} : { externalSku: row.external_sku }),
    rawPayload: toRawPayload(row.raw_payload),
    ...(proposedProduct === undefined ? {} : { proposedProduct }),
    validationErrors: toValidationErrors(row.validation_errors),
    status: row.status,
    ...(row.published_product_id === null
      ? {}
      : {
          publishedProductId: asId<"ProductId">(row.published_product_id),
        }),
    ...(row.published_variant_id === null
      ? {}
      : { publishedVariantId: row.published_variant_id }),
    ...(row.publish_error === null ? {} : { publishError: row.publish_error }),
    ...(row.published_at === null ? {} : { publishedAt: row.published_at }),
    ...(row.published_by_staff_id === null
      ? {}
      : {
          publishedByStaffId: asId<"StaffId">(row.published_by_staff_id),
        }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toReviewTask(row: MetadataReviewTaskRow): MetadataReviewTask {
  return {
    id: asId<"MetadataReviewTaskId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    ...(row.import_row_id === null
      ? {}
      : { importRowId: asId<"CatalogueImportRowId">(row.import_row_id) }),
    ...(row.assignment_id === null ? {} : { assignmentId: row.assignment_id }),
    ...(row.proposed_concept_id === null
      ? {}
      : {
          proposedConceptId: asId<"MetadataConceptId">(row.proposed_concept_id),
        }),
    proposedValue: row.proposed_value,
    source: row.source,
    ...(row.confidence === null ? {} : { confidence: row.confidence }),
    status: row.status,
    ...(row.reviewed_by_staff_id === null
      ? {}
      : { reviewedByStaffId: asId<"StaffId">(row.reviewed_by_staff_id) }),
    ...(row.reviewed_at === null ? {} : { reviewedAt: row.reviewed_at }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CatalogueImportRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(
    retailerId: RetailerId,
    id: CatalogueImportId,
  ): Promise<CatalogueImport | null> {
    const { data, error } = await this.client
      .from("catalogue_imports")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toImport(data) : null;
  }

  async listForRetailer(
    retailerId: RetailerId,
  ): Promise<readonly CatalogueImport[]> {
    const { data, error } = await this.client
      .from("catalogue_imports")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toImport);
  }

  async findRows(
    retailerId: RetailerId,
    importId: CatalogueImportId,
  ): Promise<readonly CatalogueImportRow[]> {
    const { data, error } = await this.client
      .from("catalogue_import_rows")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("import_id", importId)
      .order("row_number", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toImportRow);
  }

  async findReviewTasksForImport(
    retailerId: RetailerId,
    importId: CatalogueImportId,
  ): Promise<readonly MetadataReviewTask[]> {
    const rows = await this.findRows(retailerId, importId);
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
    if (error) throw error;
    return (data ?? []).map(toReviewTask);
  }

  async loadExistingCatalogue(
    retailerId: RetailerId,
  ): Promise<CatalogueImportExistingCatalogue> {
    const [
      { data: products, error: productError },
      { data: variants, error: variantError },
      { data: fabrics, error: fabricError },
    ] = await Promise.all([
      this.client
        .from("products")
        .select("id, slug, primary_image_url")
        .eq("retailer_id", retailerId)
        .is("deleted_at", null),
      this.client
        .from("product_variants")
        .select("sku, product_id, products!inner(retailer_id, deleted_at)")
        .eq("products.retailer_id", retailerId)
        .is("products.deleted_at", null)
        .is("deleted_at", null),
      this.client
        .from("product_fabric_profiles")
        .select("supplier_reference")
        .eq("retailer_id", retailerId)
        .is("deleted_at", null),
    ]);
    if (productError) throw productError;
    if (variantError) throw variantError;
    if (fabricError) throw fabricError;

    const skus = new Set<string>();
    const productIdsBySku = new Map<string, ProductId>();
    for (const variant of variants ?? []) {
      skus.add(variant.sku);
      productIdsBySku.set(variant.sku, asId<"ProductId">(variant.product_id));
    }

    const slugs = new Set<string>();
    const primaryImageUrls = new Set<string>();
    for (const product of products ?? []) {
      slugs.add(product.slug);
      if (product.primary_image_url) {
        primaryImageUrls.add(product.primary_image_url);
      }
    }

    const supplierReferences = new Set<string>();
    for (const fabric of fabrics ?? []) {
      if (fabric.supplier_reference) {
        supplierReferences.add(fabric.supplier_reference);
      }
    }

    return {
      skus,
      supplierReferences,
      slugs,
      primaryImageUrls,
      productIdsBySku,
    };
  }

  /**
   * Persist a preview job with review tasks keyed by import row number.
   * Preview never sets row status to published.
   */
  async savePreview(params: {
    readonly retailerId: RetailerId;
    readonly uploadedByStaffId: string;
    readonly sourceFilename: string;
    readonly sourceType: Exclude<CatalogueImportSourceType, "pdf">;
    readonly contractVersion: string;
    readonly status?: CatalogueImportStatus;
    readonly rows: readonly {
      readonly rowNumber: number;
      readonly externalSku?: string;
      readonly rawPayload: Readonly<Record<string, unknown>>;
      readonly proposedProduct?: CatalogueImportProposedProduct;
      readonly validationErrors: readonly CatalogueImportValidationIssue[];
      readonly status: Extract<CatalogueImportRowStatus, "pending" | "valid">;
      readonly reviewTasks: readonly {
        readonly proposedValue: string;
        readonly field: string;
        readonly explanation: string;
      }[];
    }[];
  }): Promise<{
    readonly import: CatalogueImport;
    readonly rows: readonly CatalogueImportRow[];
    readonly reviewTasks: readonly MetadataReviewTask[];
  }> {
    if (params.rows.some((row) => (row.status as string) === "published")) {
      throw new Error("Preview cannot persist published import rows");
    }

    const { data: importRow, error: importError } = await this.client
      .from("catalogue_imports")
      .insert({
        retailer_id: params.retailerId,
        uploaded_by_staff_id: params.uploadedByStaffId,
        source_filename: params.sourceFilename,
        source_type: params.sourceType,
        row_count: params.rows.length,
        contract_version: params.contractVersion,
        status: params.status ?? "previewing",
      })
      .select("*")
      .single();
    if (importError) throw importError;
    const createdImport = toImport(importRow);

    const { data: rowData, error: rowError } = await this.client
      .from("catalogue_import_rows")
      .insert(
        params.rows.map((row) => ({
          import_id: createdImport.id,
          retailer_id: params.retailerId,
          row_number: row.rowNumber,
          external_sku: row.externalSku ?? null,
          raw_payload: toJson(row.rawPayload),
          proposed_product:
            row.proposedProduct === undefined
              ? null
              : toJson(row.proposedProduct),
          validation_errors: toJson(row.validationErrors),
          status: row.status,
        })),
      )
      .select("*");
    if (rowError) throw rowError;
    const createdRows = (rowData ?? []).map(toImportRow);
    const rowIdByNumber = new Map(
      createdRows.map((row) => [row.rowNumber, row.id]),
    );

    const taskPayload = params.rows.flatMap((row) => {
      const importRowId = rowIdByNumber.get(row.rowNumber);
      if (importRowId === undefined) {
        return [];
      }
      return row.reviewTasks.map((task) => ({
        retailer_id: params.retailerId,
        import_row_id: importRowId,
        assignment_id: null,
        proposed_concept_id: null,
        proposed_value: `${task.field}: ${task.proposedValue}`,
        source: "supplier" as const,
        confidence: null,
        status: "pending" as const satisfies MetadataReviewTaskStatus,
      }));
    });

    let createdTasks: MetadataReviewTask[] = [];
    if (taskPayload.length > 0) {
      const { data: taskData, error: taskError } = await this.client
        .from("metadata_review_tasks")
        .insert(taskPayload)
        .select("*");
      if (taskError) throw taskError;
      createdTasks = (taskData ?? []).map(toReviewTask);
    }

    return {
      import: createdImport,
      rows: createdRows,
      reviewTasks: createdTasks,
    };
  }

  async reviewMetadataTask(params: {
    readonly retailerId: RetailerId;
    readonly taskId: MetadataReviewTaskId;
    readonly status: Exclude<
      MetadataReviewTaskStatus,
      "pending"
    >;
    readonly proposedConceptId?: string;
  }): Promise<MetadataReviewTask> {
    const { data, error } = await this.client.rpc(
      "review_catalogue_import_metadata_task",
      {
        p_task_id: params.taskId,
        p_status: params.status,
        p_proposed_concept_id: params.proposedConceptId ?? undefined,
      },
    );
    if (error) {
      throw error;
    }

    const { data: taskRow, error: reloadError } = await this.client
      .from("metadata_review_tasks")
      .select("*")
      .eq("retailer_id", params.retailerId)
      .eq("id", data)
      .maybeSingle();
    if (reloadError) {
      throw reloadError;
    }
    if (taskRow === null) {
      throw new Error("Reviewed metadata task could not be reloaded");
    }
    return toReviewTask(taskRow);
  }

  async publishRow(params: {
    readonly retailerId: RetailerId;
    readonly importRowId: CatalogueImportRowId;
  }): Promise<CatalogueImportPublishResult> {
    const { data: rowData, error: rowError } = await this.client
      .from("catalogue_import_rows")
      .select("*")
      .eq("retailer_id", params.retailerId)
      .eq("id", params.importRowId)
      .maybeSingle();

    if (rowError) {
      throw rowError;
    }
    if (rowData === null) {
      throw new Error("Catalogue import row is unavailable");
    }

    const importId = asId<"CatalogueImportId">(rowData.import_id);
    const domainRow = toImportRow(rowData);
    const reviewTasks = (
      await this.findReviewTasksForImport(params.retailerId, importId)
    ).filter((task) => task.importRowId === params.importRowId);

    const eligibility = assessCatalogueImportRowPublishEligibility({
      row: domainRow,
      reviewTasks,
    });
    if (!eligibility.eligible && domainRow.status !== "published") {
      throw new Error(
        eligibility.blockers[0]?.message ?? "Row is not publishable",
      );
    }

    try {
      const { data, error } = await this.client.rpc(
        "publish_catalogue_import_row",
        { p_import_row_id: params.importRowId },
      );
      if (error) {
        throw error;
      }
      const payload = data as {
        productId: string;
        variantId: string;
        idempotent: boolean;
      };
      return {
        productId: payload.productId,
        variantId: payload.variantId,
        idempotent: payload.idempotent,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Publish failed unexpectedly";
      await this.client
        .from("catalogue_import_rows")
        .update({ publish_error: message.slice(0, 2000) })
        .eq("retailer_id", params.retailerId)
        .eq("id", params.importRowId);
      throw error;
    }
  }

  async publishEligibleRows(params: {
    readonly retailerId: RetailerId;
    readonly importId: CatalogueImportId;
  }): Promise<{
    readonly published: readonly CatalogueImportPublishResult[];
    readonly failures: readonly { readonly rowId: CatalogueImportRowId; readonly message: string }[];
  }> {
    const [rows, reviewTasks] = await Promise.all([
      this.findRows(params.retailerId, params.importId),
      this.findReviewTasksForImport(params.retailerId, params.importId),
    ]);

    const tasksByRowId = new Map<string, MetadataReviewTask[]>();
    for (const task of reviewTasks) {
      if (!task.importRowId) continue;
      const existing = tasksByRowId.get(task.importRowId) ?? [];
      tasksByRowId.set(task.importRowId, [...existing, task]);
    }

    const published: CatalogueImportPublishResult[] = [];
    const failures: { rowId: CatalogueImportRowId; message: string }[] = [];

    for (const row of rows) {
      if (row.status === "published") {
        continue;
      }
      const eligibility = assessCatalogueImportRowPublishEligibility({
        row,
        reviewTasks: tasksByRowId.get(row.id) ?? [],
      });
      if (!eligibility.eligible) {
        continue;
      }
      try {
        published.push(
          await this.publishRow({
            retailerId: params.retailerId,
            importRowId: row.id,
          }),
        );
      } catch (error) {
        failures.push({
          rowId: row.id,
          message:
            error instanceof Error ? error.message : "Publish failed unexpectedly",
        });
      }
    }

    return { published, failures };
  }
}
