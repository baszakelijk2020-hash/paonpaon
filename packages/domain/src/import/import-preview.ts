import type { MetadataConceptId } from "../shared/branded-id";

import type {
  CatalogueImportAssetMatch,
  CatalogueImportCategoryMapping,
  CatalogueImportExistingCatalogue,
  CatalogueImportParseResult,
  CatalogueImportParsedRow,
  CatalogueImportPreview,
  CatalogueImportPreviewRow,
  CatalogueImportProposedProduct,
  CatalogueImportValidationIssue,
} from "./import";
import {
  CATALOGUE_IMPORT_CATEGORY_COLUMNS,
  CATALOGUE_IMPORT_COLUMN_KIND,
  CATALOGUE_IMPORT_CONTRACT_VERSION,
  CATALOGUE_IMPORT_REQUIRED_COLUMNS,
  type CatalogueImportCategoryColumn,
  type CatalogueImportColumn,
} from "./import-contract";

export interface CatalogueImportConceptLookup {
  readonly findByKindAndLabel: (
    kind: string,
    label: string,
  ) => { readonly id: MetadataConceptId; readonly slug: string } | null;
}

const EMPTY_CONCEPT_LOOKUP: CatalogueImportConceptLookup = {
  findByKindAndLabel: () => null,
};

const EMPTY_EXISTING: CatalogueImportExistingCatalogue = {
  skus: new Set(),
  supplierReferences: new Set(),
  slugs: new Set(),
  primaryImageUrls: new Set(),
  productIdsBySku: new Map(),
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function parsePriceMinorUnits(raw: string): number | undefined {
  if (raw.length === 0) return undefined;
  const normalized = raw.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  const [major, fraction = ""] = normalized.split(".");
  const cents = (fraction + "00").slice(0, 2);
  return Number.parseInt(major!, 10) * 100 + Number.parseInt(cents, 10);
}

function parseWeightGsm(raw: string): number | undefined {
  if (raw.length === 0) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return undefined;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 2000) return undefined;
  return value;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function cell(
  row: CatalogueImportParsedRow,
  column: CatalogueImportColumn,
): string {
  return row.cells[column] ?? "";
}

function matchAsset(
  role: "primary" | "swatch",
  sourceUrl: string | undefined,
  existing: CatalogueImportExistingCatalogue,
): CatalogueImportAssetMatch {
  if (sourceUrl === undefined || sourceUrl.length === 0) {
    return {
      role,
      matched: false,
      matchReason:
        role === "primary"
          ? "No primary image URL supplied; asset matching skipped."
          : "No swatch image URL supplied; asset matching skipped.",
    };
  }
  if (!isHttpUrl(sourceUrl)) {
    return {
      role,
      sourceUrl,
      matched: false,
      matchReason: "Image URL is not a valid http(s) URL.",
    };
  }
  if (existing.primaryImageUrls.has(sourceUrl)) {
    return {
      role,
      sourceUrl,
      matched: true,
      matchReason:
        "Exact URL match against an existing product primary image for this retailer.",
    };
  }
  return {
    role,
    sourceUrl,
    matched: true,
    matchReason:
      "URL is well-formed and will be treated as a new asset fingerprint for this retailer.",
  };
}

function mapCategory(
  column: CatalogueImportCategoryColumn,
  rawValue: string,
  lookup: CatalogueImportConceptLookup,
): CatalogueImportCategoryMapping {
  const kind = CATALOGUE_IMPORT_COLUMN_KIND[column];
  const match = lookup.findByKindAndLabel(kind, rawValue);
  if (match) {
    return {
      rawValue,
      mappedConceptSlug: match.slug,
      mappedConceptId: match.id,
      status: "mapped",
      explanation: `Mapped supplier "${rawValue}" to accepted ${kind} concept "${match.slug}".`,
    };
  }
  const proposedSlug = slugify(rawValue);
  return {
    rawValue,
    ...(proposedSlug.length > 0 ? { mappedConceptSlug: proposedSlug } : {}),
    status: "proposed",
    explanation: `No accepted ${kind} concept matches "${rawValue}". Preview creates a review task; nothing is published.`,
  };
}

function validateRow(
  row: CatalogueImportParsedRow,
  existing: CatalogueImportExistingCatalogue,
  lookup: CatalogueImportConceptLookup,
  skuCounts: Map<string, number>,
): CatalogueImportPreviewRow {
  const issues: CatalogueImportValidationIssue[] = [];
  const externalSku = cell(row, "external_sku");
  const name = cell(row, "name");
  const description = cell(row, "description");
  const priceRaw = cell(row, "price");
  const currency = cell(row, "currency").toUpperCase();
  const primaryImageUrl = cell(row, "primary_image_url");
  const swatchImageUrl = cell(row, "swatch_image_url");
  const weightRaw = cell(row, "weight_gsm");
  const supplierReference = cell(row, "supplier_reference");

  for (const column of CATALOGUE_IMPORT_REQUIRED_COLUMNS) {
    // description and swatch may be intentionally empty strings; other
    // required columns must contain a value after trim.
    if (column === "description" || column === "swatch_image_url") {
      continue;
    }
    if (cell(row, column).length === 0) {
      issues.push({
        code: "missing_required",
        severity: "error",
        field: column,
        message: `Missing required value for ${column}`,
        explanation: `Contract ${CATALOGUE_IMPORT_CONTRACT_VERSION} requires a non-empty ${column} on every data row.`,
      });
    }
  }

  const priceAmountMinorUnits = parsePriceMinorUnits(priceRaw);
  if (priceRaw.length > 0 && priceAmountMinorUnits === undefined) {
    issues.push({
      code: "invalid_value",
      severity: "error",
      field: "price",
      message: "Price must be a decimal major-unit amount",
      explanation: `Could not parse "${priceRaw}" as a price with at most two decimal places.`,
    });
  }

  if (currency.length > 0 && !/^[A-Z]{3}$/.test(currency)) {
    issues.push({
      code: "invalid_value",
      severity: "error",
      field: "currency",
      message: "Currency must be a 3-letter ISO code",
      explanation: `Value "${currency}" is not a valid ISO 4217 currency code.`,
    });
  }

  const weightGsm = parseWeightGsm(weightRaw);
  if (weightRaw.length > 0 && weightGsm === undefined) {
    issues.push({
      code: "invalid_value",
      severity: "error",
      field: "weight_gsm",
      message: "weight_gsm must be a positive number",
      explanation: `Could not parse "${weightRaw}" as grams per square metre.`,
    });
  }

  if (primaryImageUrl.length > 0 && !isHttpUrl(primaryImageUrl)) {
    issues.push({
      code: "invalid_value",
      severity: "error",
      field: "primary_image_url",
      message: "primary_image_url must be an http(s) URL",
      explanation: "Asset matching requires a valid absolute image URL.",
    });
  }

  if (swatchImageUrl.length > 0 && !isHttpUrl(swatchImageUrl)) {
    issues.push({
      code: "invalid_value",
      severity: "error",
      field: "swatch_image_url",
      message: "swatch_image_url must be an http(s) URL",
      explanation:
        "Swatch matching requires a valid absolute image URL when provided.",
    });
  }

  if (externalSku.length > 0) {
    const count = skuCounts.get(externalSku) ?? 0;
    if (count > 1) {
      issues.push({
        code: "duplicate_in_file",
        severity: "error",
        field: "external_sku",
        message: "Duplicate external_sku in this file",
        explanation: `SKU "${externalSku}" appears ${count} times in the upload. Resolve duplicates before publish.`,
      });
    }
    if (existing.skus.has(externalSku)) {
      issues.push({
        code: "duplicate_existing_sku",
        severity: "warning",
        field: "external_sku",
        message: "SKU already exists for this retailer",
        explanation: `Preview matched existing catalogue SKU "${externalSku}". Publishing later would update rather than create once review completes.`,
      });
    }
  }

  if (
    supplierReference.length > 0 &&
    existing.supplierReferences.has(supplierReference)
  ) {
    issues.push({
      code: "duplicate_existing_sku",
      severity: "warning",
      field: "supplier_reference",
      message: "Supplier reference already exists for this retailer",
      explanation: `Supplier reference "${supplierReference}" matches an existing catalogue fact.`,
    });
  }

  const proposedSlug = name.length > 0 ? slugify(name) : undefined;
  if (proposedSlug && existing.slugs.has(proposedSlug)) {
    issues.push({
      code: "duplicate_existing_slug",
      severity: "warning",
      field: "name",
      message: "Proposed slug already exists",
      explanation: `Slug "${proposedSlug}" derived from the product name already exists for this retailer.`,
    });
  }

  if (
    primaryImageUrl.length > 0 &&
    existing.primaryImageUrls.has(primaryImageUrl)
  ) {
    issues.push({
      code: "duplicate_existing_image",
      severity: "info",
      field: "primary_image_url",
      message: "Primary image URL already used",
      explanation:
        "Exact primary image URL fingerprint matches an existing product for this retailer.",
    });
  }

  const categoryMappings: CatalogueImportCategoryMapping[] = [];
  const reviewTasks: {
    proposedValue: string;
    field: string;
    explanation: string;
  }[] = [];

  for (const column of CATALOGUE_IMPORT_CATEGORY_COLUMNS) {
    const rawValue = cell(row, column);
    if (rawValue.length === 0) continue;
    const mapping = mapCategory(column, rawValue, lookup);
    categoryMappings.push(mapping);
    if (mapping.status !== "mapped") {
      reviewTasks.push({
        field: column,
        proposedValue: rawValue,
        explanation: mapping.explanation,
      });
      issues.push({
        code: "category_unmapped",
        severity: "warning",
        field: column,
        message: `Unmapped ${column} value`,
        explanation: mapping.explanation,
      });
    }
  }

  const assetMatches = [
    matchAsset(
      "primary",
      primaryImageUrl.length > 0 ? primaryImageUrl : undefined,
      existing,
    ),
    matchAsset(
      "swatch",
      swatchImageUrl.length > 0 ? swatchImageUrl : undefined,
      existing,
    ),
  ];

  for (const asset of assetMatches) {
    if (!asset.matched && asset.sourceUrl) {
      issues.push({
        code: "asset_unmatched",
        severity: "warning",
        field:
          asset.role === "primary" ? "primary_image_url" : "swatch_image_url",
        message: `${asset.role} image could not be matched`,
        explanation: asset.matchReason,
      });
    }
  }

  const proposedProduct: CatalogueImportProposedProduct | undefined =
    externalSku.length > 0 && name.length > 0
      ? {
          externalSku,
          name,
          ...(description.length > 0 ? { description } : {}),
          ...(cell(row, "garment_type").length > 0
            ? { garmentType: cell(row, "garment_type") }
            : {}),
          ...(priceAmountMinorUnits !== undefined
            ? { priceAmountMinorUnits }
            : {}),
          ...(currency.length === 3 ? { currency } : {}),
          ...(primaryImageUrl.length > 0 && isHttpUrl(primaryImageUrl)
            ? { primaryImageUrl }
            : {}),
          ...(swatchImageUrl.length > 0 && isHttpUrl(swatchImageUrl)
            ? { swatchImageUrl }
            : {}),
          ...(cell(row, "mill").length > 0 ? { mill: cell(row, "mill") } : {}),
          ...(cell(row, "collection").length > 0
            ? { collection: cell(row, "collection") }
            : {}),
          ...(cell(row, "composition").length > 0
            ? { composition: cell(row, "composition") }
            : {}),
          ...(weightGsm !== undefined ? { weightGsm } : {}),
          ...(cell(row, "season").length > 0
            ? { season: cell(row, "season") }
            : {}),
          ...(cell(row, "colour").length > 0
            ? { colour: cell(row, "colour") }
            : {}),
          ...(supplierReference.length > 0 ? { supplierReference } : {}),
          ...(cell(row, "weave").length > 0
            ? { weave: cell(row, "weave") }
            : {}),
          ...(cell(row, "pattern").length > 0
            ? { pattern: cell(row, "pattern") }
            : {}),
          ...(cell(row, "construction").length > 0
            ? { construction: cell(row, "construction") }
            : {}),
          ...(cell(row, "fit").length > 0 ? { fit: cell(row, "fit") } : {}),
          ...(cell(row, "formality").length > 0
            ? { formality: cell(row, "formality") }
            : {}),
          ...(cell(row, "occasion").length > 0
            ? { occasion: cell(row, "occasion") }
            : {}),
          ...(cell(row, "climate").length > 0
            ? { climate: cell(row, "climate") }
            : {}),
          ...(cell(row, "performance").length > 0
            ? { performance: cell(row, "performance") }
            : {}),
          ...(cell(row, "care").length > 0 ? { care: cell(row, "care") } : {}),
          ...(proposedSlug ? { proposedSlug } : {}),
          assetMatches,
          categoryMappings,
        }
      : undefined;

  const hasError = issues.some((issue) => issue.severity === "error");

  return {
    rowNumber: row.rowNumber,
    ...(externalSku.length > 0 ? { externalSku } : {}),
    rawPayload: row.rawPayload,
    ...(proposedProduct ? { proposedProduct } : {}),
    validationErrors: issues,
    status: hasError ? "pending" : "valid",
    reviewTasks,
  };
}

export function buildCatalogueImportPreview(params: {
  readonly parseResult: CatalogueImportParseResult;
  readonly sourceFilename: string;
  readonly existing?: CatalogueImportExistingCatalogue;
  readonly conceptLookup?: CatalogueImportConceptLookup;
}): CatalogueImportPreview {
  const existing = params.existing ?? EMPTY_EXISTING;
  const lookup = params.conceptLookup ?? EMPTY_CONCEPT_LOOKUP;
  const skuCounts = new Map<string, number>();

  for (const row of params.parseResult.rows) {
    const sku = cell(row, "external_sku");
    if (sku.length === 0) continue;
    skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
  }

  const rows = params.parseResult.rows.map((row) =>
    validateRow(row, existing, lookup, skuCounts),
  );

  return {
    contractVersion: params.parseResult.contractVersion,
    sourceType: params.parseResult.sourceType,
    sourceFilename: params.sourceFilename,
    rows,
    fileIssues: params.parseResult.issues,
    validRowCount: rows.filter((row) => row.status === "valid").length,
    errorRowCount: rows.filter((row) =>
      row.validationErrors.some((issue) => issue.severity === "error"),
    ).length,
  };
}
