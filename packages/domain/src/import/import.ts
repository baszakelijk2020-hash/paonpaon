import type { MetadataSource } from "../metadata/metadata";
import type {
  CatalogueImportId,
  CatalogueImportRowId,
  MetadataConceptId,
  MetadataReviewTaskId,
  ProductId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

/** File formats accepted today, plus PDF for a future extractor without redesign. */
export type CatalogueImportSourceType = "csv" | "xlsx" | "json" | "pdf";

export type CatalogueImportStatus =
  "uploaded" | "previewing" | "ready" | "publishing" | "completed" | "failed";

export type CatalogueImportRowStatus =
  "pending" | "valid" | "rejected" | "published";

export type MetadataReviewTaskStatus =
  "pending" | "accepted" | "rejected" | "dismissed";

export type CatalogueImportValidationCode =
  | "missing_required"
  | "invalid_value"
  | "formula_injection"
  | "duplicate_in_file"
  | "duplicate_existing_sku"
  | "duplicate_existing_slug"
  | "duplicate_existing_image"
  | "asset_unmatched"
  | "category_unmapped"
  | "size_limit"
  | "malformed_row";

export type CatalogueImportValidationSeverity = "error" | "warning" | "info";

export interface CatalogueImportValidationIssue {
  readonly code: CatalogueImportValidationCode;
  readonly severity: CatalogueImportValidationSeverity;
  readonly field?: string;
  readonly message: string;
  /** Explains how the preview resolved or failed the check. */
  readonly explanation: string;
}

export interface CatalogueImportAssetMatch {
  readonly role: "primary" | "swatch";
  readonly sourceUrl?: string;
  readonly matched: boolean;
  readonly matchReason: string;
}

export interface CatalogueImportCategoryMapping {
  readonly rawValue: string;
  readonly mappedConceptSlug?: string;
  readonly mappedConceptId?: MetadataConceptId;
  readonly status: "mapped" | "proposed" | "unmapped";
  readonly explanation: string;
}

/**
 * Normalized supplier row after parsing. Raw cells stay in `rawPayload`;
 * this shape is what preview and later publish consume.
 */
export interface CatalogueImportProposedProduct {
  readonly externalSku: string;
  readonly name: string;
  readonly description?: string;
  readonly garmentType?: string;
  readonly priceAmountMinorUnits?: number;
  readonly currency?: string;
  readonly primaryImageUrl?: string;
  readonly swatchImageUrl?: string;
  readonly mill?: string;
  readonly collection?: string;
  readonly composition?: string;
  readonly weightGsm?: number;
  readonly season?: string;
  readonly colour?: string;
  readonly supplierReference?: string;
  readonly weave?: string;
  readonly pattern?: string;
  readonly construction?: string;
  readonly fit?: string;
  readonly formality?: string;
  readonly occasion?: string;
  readonly climate?: string;
  readonly performance?: string;
  readonly care?: string;
  readonly proposedSlug?: string;
  readonly assetMatches: readonly CatalogueImportAssetMatch[];
  readonly categoryMappings: readonly CatalogueImportCategoryMapping[];
}

export interface CatalogueImport extends Timestamps {
  readonly id: CatalogueImportId;
  readonly retailerId: RetailerId;
  readonly status: CatalogueImportStatus;
  readonly uploadedByStaffId: StaffId;
  readonly sourceFilename: string;
  readonly sourceType: CatalogueImportSourceType;
  readonly rowCount: number;
  readonly contractVersion: string;
  readonly completedAt?: string;
}

export interface CatalogueImportRow {
  readonly id: CatalogueImportRowId;
  readonly importId: CatalogueImportId;
  readonly retailerId: RetailerId;
  readonly rowNumber: number;
  readonly externalSku?: string;
  readonly rawPayload: Readonly<Record<string, unknown>>;
  readonly proposedProduct?: CatalogueImportProposedProduct;
  readonly validationErrors: readonly CatalogueImportValidationIssue[];
  readonly status: CatalogueImportRowStatus;
  readonly publishedProductId?: ProductId;
  readonly publishedVariantId?: string;
  readonly publishedByStaffId?: StaffId;
  readonly publishedAt?: string;
  readonly lastPublishAttemptAt?: string;
  readonly publishError?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MetadataReviewTask {
  readonly id: MetadataReviewTaskId;
  readonly retailerId: RetailerId;
  readonly importRowId?: CatalogueImportRowId;
  readonly assignmentId?: string;
  readonly proposedConceptId?: MetadataConceptId;
  readonly proposedValue: string;
  readonly source: MetadataSource;
  readonly confidence?: number;
  readonly status: MetadataReviewTaskStatus;
  readonly reviewedByStaffId?: StaffId;
  readonly reviewedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Existing catalogue facts used for duplicate / asset matching in preview. */
export interface CatalogueImportExistingCatalogue {
  readonly skus: ReadonlySet<string>;
  readonly supplierReferences: ReadonlySet<string>;
  readonly slugs: ReadonlySet<string>;
  readonly primaryImageUrls: ReadonlySet<string>;
  readonly productIdsBySku: ReadonlyMap<string, ProductId>;
}

export interface CatalogueImportParseLimits {
  readonly maxBytes: number;
  readonly maxRows: number;
}

export const DEFAULT_CATALOGUE_IMPORT_LIMITS = {
  maxBytes: 2_000_000,
  maxRows: 2_000,
} as const satisfies CatalogueImportParseLimits;

export interface CatalogueImportParsedRow {
  readonly rowNumber: number;
  readonly rawPayload: Readonly<Record<string, string>>;
  readonly cells: Readonly<Record<string, string>>;
}

export interface CatalogueImportParseResult {
  readonly sourceType: Exclude<CatalogueImportSourceType, "pdf">;
  readonly contractVersion: string;
  readonly rows: readonly CatalogueImportParsedRow[];
  readonly issues: readonly CatalogueImportValidationIssue[];
}

export interface CatalogueImportPreviewRow {
  readonly rowNumber: number;
  readonly externalSku?: string;
  readonly rawPayload: Readonly<Record<string, string>>;
  readonly proposedProduct?: CatalogueImportProposedProduct;
  readonly validationErrors: readonly CatalogueImportValidationIssue[];
  readonly status: Extract<CatalogueImportRowStatus, "pending" | "valid">;
  readonly reviewTasks: readonly {
    readonly proposedValue: string;
    readonly field: string;
    readonly explanation: string;
  }[];
}

export interface CatalogueImportPreview {
  readonly contractVersion: string;
  readonly sourceType: Exclude<CatalogueImportSourceType, "pdf">;
  readonly sourceFilename: string;
  readonly rows: readonly CatalogueImportPreviewRow[];
  readonly fileIssues: readonly CatalogueImportValidationIssue[];
  readonly validRowCount: number;
  readonly errorRowCount: number;
}
