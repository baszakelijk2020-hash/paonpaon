import type { MetadataConceptKind, MetadataSource } from "../metadata/metadata";
import type {
  Brand,
  EntityMetadataAssignmentId,
  MetadataConceptId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";

export type CatalogueImportId = Brand<string, "CatalogueImportId">;
export type CatalogueImportRowId = Brand<string, "CatalogueImportRowId">;
export type MetadataReviewTaskId = Brand<string, "MetadataReviewTaskId">;

/** Versioned supplier-ingest contract shared by CSV, XLSX, JSON, and future PDF extractors. */
export const CATALOGUE_IMPORT_CONTRACT_VERSION = "1.0.0";

export const CATALOGUE_IMPORT_SOURCE_TYPES = [
  "csv",
  "xlsx",
  "json",
  "pdf",
] as const;

export type CatalogueImportSourceType =
  (typeof CATALOGUE_IMPORT_SOURCE_TYPES)[number];

/** Preview-only lifecycle for Stage 2.5 — publishing adds later statuses in 2.6. */
export const CATALOGUE_IMPORT_STATUSES = ["preview", "failed"] as const;

export type CatalogueImportStatus = (typeof CATALOGUE_IMPORT_STATUSES)[number];

export const CATALOGUE_IMPORT_ROW_STATUSES = [
  "pending",
  "valid",
  "rejected",
  "published",
] as const;

export type CatalogueImportRowStatus =
  (typeof CATALOGUE_IMPORT_ROW_STATUSES)[number];

export const METADATA_REVIEW_TASK_STATUSES = [
  "pending",
  "accepted",
  "rejected",
] as const;

export type MetadataReviewTaskStatus =
  (typeof METADATA_REVIEW_TASK_STATUSES)[number];

export interface CatalogueImport {
  readonly id: CatalogueImportId;
  readonly retailerId: RetailerId;
  readonly status: CatalogueImportStatus;
  readonly uploadedByStaffId: StaffId;
  readonly sourceFilename: string;
  readonly sourceType: CatalogueImportSourceType;
  readonly contractVersion: string;
  readonly rowCount: number;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface ImportValidationIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface ImportConceptMapping {
  readonly kind: MetadataConceptKind;
  readonly supplierValue: string;
  readonly conceptId?: string;
  readonly conceptSlug?: string;
  readonly conceptName?: string;
  readonly status: "matched" | "proposed" | "missing";
}

export interface ImportAssetMatch {
  readonly primaryImageUrl?: string;
  readonly swatchImageUrl?: string;
  readonly matchKey: "external_sku" | "supplier_reference";
  readonly matchValue: string;
  readonly note: string;
}

export interface ImportProposedProduct {
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly externalSku: string;
  readonly supplierReference?: string;
  readonly variantSku: string;
  readonly priceAmountMinorUnits: number;
  readonly priceCurrency: string;
  readonly weightGramsPerSquareMetre?: number;
  readonly compositionRaw?: string;
  readonly assignments: readonly ImportConceptMapping[];
  readonly assets: ImportAssetMatch;
  readonly duplicateOfRowNumbers?: readonly number[];
  readonly existingCatalogueSku?: string;
  readonly existingCatalogueSlug?: string;
}

export interface CatalogueImportRow {
  readonly id: CatalogueImportRowId;
  readonly importId: CatalogueImportId;
  readonly rowNumber: number;
  readonly externalSku: string;
  readonly rawPayload: Readonly<Record<string, string>>;
  readonly proposedProduct: ImportProposedProduct | null;
  readonly validationErrors: readonly ImportValidationIssue[];
  readonly status: CatalogueImportRowStatus;
}

export interface MetadataReviewTask {
  readonly id: MetadataReviewTaskId;
  readonly retailerId: RetailerId;
  readonly importRowId: CatalogueImportRowId | null;
  readonly assignmentId: EntityMetadataAssignmentId | null;
  readonly proposedConceptId: MetadataConceptId | null;
  readonly proposedKind: MetadataConceptKind | null;
  readonly proposedValue: string;
  readonly source: MetadataSource;
  readonly confidence: number | null;
  readonly status: MetadataReviewTaskStatus;
  readonly reviewedByStaffId: StaffId | null;
  readonly reviewedAt: string | null;
}

export interface ParsedImportRow {
  readonly rowNumber: number;
  readonly rawPayload: Readonly<Record<string, string>>;
}

export interface ImportParseResult {
  readonly sourceType: CatalogueImportSourceType;
  readonly contractVersion: string;
  readonly rows: readonly ParsedImportRow[];
  readonly parseErrors: readonly ImportValidationIssue[];
}

export interface ImportPreviewContext {
  readonly existingSkus: ReadonlySet<string>;
  readonly existingSlugs: ReadonlySet<string>;
  readonly conceptsByKind: Readonly<
    Partial<
      Record<
        MetadataConceptKind,
        readonly {
          id: string;
          slug: string;
          canonicalName: string;
        }[]
      >
    >
  >;
}

export interface ImportPreviewRow {
  readonly rowNumber: number;
  readonly externalSku: string;
  readonly rawPayload: Readonly<Record<string, string>>;
  readonly proposedProduct: ImportProposedProduct | null;
  readonly validationErrors: readonly ImportValidationIssue[];
  readonly status: CatalogueImportRowStatus;
  readonly reviewTasks: readonly {
    proposedKind: MetadataConceptKind;
    proposedValue: string;
    source: MetadataSource;
  }[];
}

export interface ImportPreviewResult {
  readonly rows: readonly ImportPreviewRow[];
  readonly validCount: number;
  readonly rejectedCount: number;
  readonly duplicateCount: number;
}
