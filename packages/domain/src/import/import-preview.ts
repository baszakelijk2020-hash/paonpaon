import type { MetadataConceptKind } from "../metadata/metadata";
import { currencyCodeSchema } from "../retailer/retailer.schema";

import type {
  ImportPreviewContext,
  ImportPreviewResult,
  ImportPreviewRow,
  ImportProposedProduct,
  ImportValidationIssue,
  ParsedImportRow,
} from "./import";
import {
  conceptKindForImportField,
  REQUIRED_IMPORT_FIELD_KEYS,
} from "./import-contract";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function issue(
  field: string,
  code: string,
  message: string,
): ImportValidationIssue {
  return { field, code, message };
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return slug.length >= 2 ? slug : "import-item";
}

function minorUnitsForPrice(
  priceText: string,
  currency: string,
): { amountMinorUnits: number } | { error: ImportValidationIssue } {
  const normalized = priceText.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return {
      error: issue(
        "price",
        "invalid",
        "Price must be a decimal with up to two places",
      ),
    };
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      error: issue("price", "invalid", "Price must be zero or greater"),
    };
  }

  const scale = currency === "JPY" ? 1 : 100;
  return { amountMinorUnits: Math.round(parsed * scale) };
}

function parseWeight(
  value: string | undefined,
): { weight: number } | { error: ImportValidationIssue } | null {
  if (!value || value.trim().length === 0) {
    return null;
  }
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 2000) {
    return {
      error: issue(
        "weight_gsm",
        "invalid",
        "Weight must be a positive number up to 2000 gsm",
      ),
    };
  }
  return { weight: parsed };
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function matchConcept(
  kind: MetadataConceptKind,
  supplierValue: string,
  context: ImportPreviewContext,
) {
  const normalized = supplierValue.trim().toLowerCase();
  const candidates = context.conceptsByKind[kind] ?? [];
  const exact = candidates.find(
    (concept) =>
      concept.slug === normalized ||
      concept.canonicalName.trim().toLowerCase() === normalized,
  );
  if (exact) {
    return {
      kind,
      supplierValue,
      conceptId: exact.id,
      conceptSlug: exact.slug,
      conceptName: exact.canonicalName,
      status: "matched" as const,
    };
  }

  const fuzzy = candidates.find((concept) =>
    concept.canonicalName.toLowerCase().includes(normalized),
  );
  if (fuzzy) {
    return {
      kind,
      supplierValue,
      conceptId: fuzzy.id,
      conceptSlug: fuzzy.slug,
      conceptName: fuzzy.canonicalName,
      status: "matched" as const,
    };
  }

  return {
    kind,
    supplierValue,
    status: "proposed" as const,
  };
}

function buildProposedProduct(
  row: ParsedImportRow,
  context: ImportPreviewContext,
  duplicateOfRowNumbers: number[],
): {
  product: ImportProposedProduct | null;
  errors: ImportValidationIssue[];
  reviewTasks: ImportPreviewRow["reviewTasks"];
} {
  const payload = row.rawPayload;
  const errors: ImportValidationIssue[] = [];
  const reviewTasks: Array<ImportPreviewRow["reviewTasks"][number]> = [];

  for (const requiredField of REQUIRED_IMPORT_FIELD_KEYS) {
    const value = payload[requiredField];
    if (!value || value.trim().length === 0) {
      errors.push(
        issue(requiredField, "required", `${requiredField} is required`),
      );
    }
  }

  const currencyResult = currencyCodeSchema.safeParse(
    (payload.currency ?? "").toUpperCase(),
  );
  if (!currencyResult.success) {
    errors.push(
      issue("currency", "invalid", "Currency must be a supported ISO code"),
    );
  }

  const priceResult =
    payload.price && currencyResult.success
      ? minorUnitsForPrice(payload.price, currencyResult.data)
      : null;
  if (priceResult && "error" in priceResult) {
    errors.push(priceResult.error);
  }

  const weightResult = parseWeight(payload.weight_gsm);
  if (weightResult && "error" in weightResult) {
    errors.push(weightResult.error);
  }

  if (payload.primary_image_url && !isValidUrl(payload.primary_image_url)) {
    errors.push(
      issue(
        "primary_image_url",
        "invalid",
        "Primary image must be a valid URL",
      ),
    );
  }
  if (payload.swatch_image_url && !isValidUrl(payload.swatch_image_url)) {
    errors.push(
      issue("swatch_image_url", "invalid", "Swatch image must be a valid URL"),
    );
  }

  const externalSku = payload.external_sku?.trim() ?? "";
  const supplierReference = payload.supplier_reference?.trim();
  const name = payload.name?.trim() ?? "";
  const slug = slugify(name);
  if (!slugPattern.test(slug)) {
    errors.push(
      issue("name", "invalid_slug", "Name could not produce a valid slug"),
    );
  }

  const assignments = Object.entries(payload)
    .map(([fieldKey, supplierValue]) => {
      const kind = conceptKindForImportField(fieldKey);
      if (!kind || !supplierValue.trim()) {
        return null;
      }
      const mapping = matchConcept(kind, supplierValue, context);
      if (mapping.status === "proposed") {
        reviewTasks.push({
          proposedKind: kind,
          proposedValue: supplierValue,
          source: "supplier",
        });
      }
      return mapping;
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  const garmentType = payload.garment_type?.trim();
  if (
    garmentType &&
    !assignments.some((item) => item.kind === "garment_type")
  ) {
    const mapping = matchConcept("garment_type", garmentType, context);
    assignments.unshift(mapping);
    if (mapping.status === "proposed") {
      reviewTasks.push({
        proposedKind: "garment_type",
        proposedValue: garmentType,
        source: "supplier",
      });
    }
  }

  const matchKey = supplierReference ? "supplier_reference" : "external_sku";
  const matchValue = supplierReference ?? externalSku;
  const assets = {
    ...(payload.primary_image_url
      ? { primaryImageUrl: payload.primary_image_url }
      : {}),
    ...(payload.swatch_image_url
      ? { swatchImageUrl: payload.swatch_image_url }
      : {}),
    matchKey,
    matchValue,
    note:
      matchKey === "supplier_reference"
        ? "Assets will match on supplier reference first, then external SKU"
        : "Assets will match on external SKU within this retailer",
  } as ImportProposedProduct["assets"];

  const existingCatalogueSku = context.existingSkus.has(externalSku)
    ? externalSku
    : undefined;
  const existingCatalogueSlug = context.existingSlugs.has(slug)
    ? slug
    : undefined;

  if (existingCatalogueSku) {
    errors.push(
      issue(
        "external_sku",
        "duplicate_catalogue",
        `SKU "${externalSku}" already exists in the catalogue`,
      ),
    );
  }
  if (existingCatalogueSlug) {
    errors.push(
      issue(
        "name",
        "duplicate_catalogue",
        `Product slug "${slug}" already exists in the catalogue`,
      ),
    );
  }
  if (duplicateOfRowNumbers.length > 0) {
    errors.push(
      issue(
        "external_sku",
        "duplicate_file",
        `Duplicate of row${duplicateOfRowNumbers.length === 1 ? "" : "s"} ${duplicateOfRowNumbers.join(", ")}`,
      ),
    );
  }

  if (
    errors.length > 0 ||
    !currencyResult.success ||
    !priceResult ||
    "error" in priceResult
  ) {
    return { product: null, errors, reviewTasks };
  }

  const product: ImportProposedProduct = {
    name,
    slug,
    description: payload.description?.trim() ?? "",
    externalSku,
    ...(supplierReference ? { supplierReference } : {}),
    variantSku: externalSku,
    priceAmountMinorUnits: priceResult.amountMinorUnits,
    priceCurrency: currencyResult.data,
    ...(weightResult && "weight" in weightResult
      ? { weightGramsPerSquareMetre: weightResult.weight }
      : {}),
    ...(payload.composition?.trim()
      ? { compositionRaw: payload.composition.trim() }
      : {}),
    assignments,
    assets,
    ...(duplicateOfRowNumbers.length > 0 ? { duplicateOfRowNumbers } : {}),
    ...(existingCatalogueSku ? { existingCatalogueSku } : {}),
    ...(existingCatalogueSlug ? { existingCatalogueSlug } : {}),
  };

  return { product, errors, reviewTasks };
}

export function buildImportPreview(
  rows: readonly ParsedImportRow[],
  context: ImportPreviewContext,
): ImportPreviewResult {
  const skuIndex = new Map<string, number[]>();
  const referenceIndex = new Map<string, number[]>();

  for (const row of rows) {
    const sku = row.rawPayload.external_sku?.trim();
    if (sku) {
      const existing = skuIndex.get(sku) ?? [];
      existing.push(row.rowNumber);
      skuIndex.set(sku, existing);
    }
    const reference = row.rawPayload.supplier_reference?.trim();
    if (reference) {
      const existing = referenceIndex.get(reference) ?? [];
      existing.push(row.rowNumber);
      referenceIndex.set(reference, existing);
    }
  }

  const previewRows: ImportPreviewRow[] = rows.map((row) => {
    const sku = row.rawPayload.external_sku?.trim() ?? "";
    const reference = row.rawPayload.supplier_reference?.trim();
    const duplicateRows = new Set<number>();
    for (const match of skuIndex.get(sku) ?? []) {
      if (match !== row.rowNumber) {
        duplicateRows.add(match);
      }
    }
    if (reference) {
      for (const match of referenceIndex.get(reference) ?? []) {
        if (match !== row.rowNumber) {
          duplicateRows.add(match);
        }
      }
    }

    const built = buildProposedProduct(row, context, [...duplicateRows].sort());
    const status =
      built.errors.length > 0 ? ("rejected" as const) : ("valid" as const);

    return {
      rowNumber: row.rowNumber,
      externalSku: sku,
      rawPayload: row.rawPayload,
      proposedProduct: built.product,
      validationErrors: built.errors,
      status,
      reviewTasks: built.reviewTasks,
    };
  });

  return {
    rows: previewRows,
    validCount: previewRows.filter((row) => row.status === "valid").length,
    rejectedCount: previewRows.filter((row) => row.status === "rejected")
      .length,
    duplicateCount: previewRows.filter((row) =>
      row.validationErrors.some((error) => error.code === "duplicate_file"),
    ).length,
  };
}
