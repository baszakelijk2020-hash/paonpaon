import type { MetadataConceptId } from "../shared/branded-id";

import type {
  CatalogueImportCategoryMapping,
  CatalogueImportProposedProduct,
} from "./import";
import {
  CATALOGUE_IMPORT_CATEGORY_COLUMNS,
  CATALOGUE_IMPORT_COLUMN_KIND,
  type CatalogueImportCategoryColumn,
} from "./import-contract";
import {
  catalogueImportEnrichmentProposalSchema,
  type CatalogueImportEnrichmentProposalParsed,
} from "./import-enrichment.schema";

/** Supplier facts the model must never invent or override (IMP-003). */
export const PROTECTED_SUPPLIER_IMPORT_FIELDS = [
  "external_sku",
  "mill",
  "composition",
  "weight_gsm",
  "construction",
  "supplier_reference",
  "name",
  "price",
  "currency",
  "primary_image_url",
  "swatch_image_url",
  "description",
] as const;

export type ProtectedSupplierImportField =
  (typeof PROTECTED_SUPPLIER_IMPORT_FIELDS)[number];

/** Category columns where only supplier_text sourcing is allowed. */
export const SUPPLIER_ONLY_CATEGORY_FIELDS = [
  "mill",
  "construction",
] as const satisfies readonly CatalogueImportCategoryColumn[];

export type CatalogueImportEnrichmentValidationCode =
  | "invalid_schema"
  | "invented_protected_fact"
  | "invalid_supplier_source"
  | "unknown_taxonomy"
  | "duplicate_field";

export interface CatalogueImportEnrichmentValidationIssue {
  readonly code: CatalogueImportEnrichmentValidationCode;
  readonly field?: string;
  readonly message: string;
}

export interface CatalogueImportEnrichmentTaxonomyLookup {
  readonly isKnownConcept: (kind: string, slug: string) => boolean;
  readonly findConceptId: (
    kind: string,
    slug: string,
  ) => MetadataConceptId | null;
}

export interface CatalogueImportEnrichmentMergeResult {
  readonly proposedProduct: CatalogueImportProposedProduct;
  readonly reviewTasks: readonly {
    readonly field: string;
    readonly proposedValue: string;
    readonly explanation: string;
    readonly confidence: number;
  }[];
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normalizeConceptSlug(value: string): string {
  return slugify(value).replace(/-/g, "_");
}

function supplierCell(
  supplierRow: Readonly<Record<string, string>>,
  field: string,
): string {
  return (supplierRow[field] ?? "").trim();
}

function isProtectedField(
  field: string,
): field is ProtectedSupplierImportField {
  return (PROTECTED_SUPPLIER_IMPORT_FIELDS as readonly string[]).includes(
    field,
  );
}

function isSupplierOnlyCategoryField(
  field: CatalogueImportCategoryColumn,
): boolean {
  return (SUPPLIER_ONLY_CATEGORY_FIELDS as readonly string[]).includes(field);
}

export type CatalogueImportEnrichmentValidationResult =
  | {
      readonly ok: true;
      readonly proposal: CatalogueImportEnrichmentProposalParsed;
    }
  | {
      readonly ok: false;
      readonly issues: readonly CatalogueImportEnrichmentValidationIssue[];
    };

/**
 * Parse and validate an AI enrichment proposal against supplier facts and
 * taxonomy. Unknown taxonomy slugs are allowed but never auto-accepted.
 */
export function validateEnrichmentProposal(params: {
  readonly raw: unknown;
  readonly supplierRow: Readonly<Record<string, string>>;
  readonly taxonomy: CatalogueImportEnrichmentTaxonomyLookup;
}): CatalogueImportEnrichmentValidationResult {
  const parsed = catalogueImportEnrichmentProposalSchema.safeParse(params.raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid_schema",
          message:
            parsed.error.issues[0]?.message ??
            "Enrichment proposal did not match the PAON schema.",
        },
      ],
    };
  }

  const issues: CatalogueImportEnrichmentValidationIssue[] = [];
  const seenFields = new Set<string>();

  for (const mapping of parsed.data.taxonomyMappings) {
    if (seenFields.has(`taxonomy:${mapping.field}`)) {
      issues.push({
        code: "duplicate_field",
        field: mapping.field,
        message: `Duplicate taxonomy mapping for ${mapping.field}.`,
      });
      continue;
    }
    seenFields.add(`taxonomy:${mapping.field}`);

    if (
      isSupplierOnlyCategoryField(mapping.field) &&
      mapping.source !== "supplier_text"
    ) {
      issues.push({
        code: "invalid_supplier_source",
        field: mapping.field,
        message: `${mapping.field} mappings must cite supplier_text, not ${mapping.source}.`,
      });
      continue;
    }

    const supplierValue = supplierCell(params.supplierRow, mapping.field);
    if (supplierValue.length === 0) {
      issues.push({
        code: "invented_protected_fact",
        field: mapping.field,
        message: `Cannot map ${mapping.field} when the supplier row is empty.`,
      });
      continue;
    }

    const supplierSlug = normalizeConceptSlug(supplierValue);
    const proposedSlug = normalizeConceptSlug(mapping.conceptSlug);
    if (
      isSupplierOnlyCategoryField(mapping.field) &&
      supplierSlug.length > 0 &&
      proposedSlug.length > 0 &&
      supplierSlug !== proposedSlug &&
      !supplierValue
        .toLowerCase()
        .includes(mapping.conceptSlug.replace(/_/g, " ").toLowerCase())
    ) {
      issues.push({
        code: "invented_protected_fact",
        field: mapping.field,
        message: `Proposed ${mapping.field} slug "${mapping.conceptSlug}" does not match supplier value "${supplierValue}".`,
      });
    }

    const kind = CATALOGUE_IMPORT_COLUMN_KIND[mapping.field];
    if (
      !params.taxonomy.isKnownConcept(kind, mapping.conceptSlug) &&
      !params.taxonomy.isKnownConcept(kind, proposedSlug)
    ) {
      issues.push({
        code: "unknown_taxonomy",
        field: mapping.field,
        message: `Unknown ${kind} concept "${mapping.conceptSlug}" — will require review if accepted.`,
      });
    }
  }

  for (const derived of parsed.data.derivedSuitability) {
    if (seenFields.has(`derived:${derived.field}`)) {
      issues.push({
        code: "duplicate_field",
        field: derived.field,
        message: `Duplicate derived suitability for ${derived.field}.`,
      });
      continue;
    }
    seenFields.add(`derived:${derived.field}`);

    if (isProtectedField(derived.field)) {
      issues.push({
        code: "invented_protected_fact",
        field: derived.field,
        message: `Protected supplier field ${derived.field} cannot be derived.`,
      });
      continue;
    }

    if (isSupplierOnlyCategoryField(derived.field)) {
      issues.push({
        code: "invented_protected_fact",
        field: derived.field,
        message: `${derived.field} cannot be derived; only supplier_text mappings are allowed.`,
      });
    }

    const supplierValue = supplierCell(params.supplierRow, derived.field);
    if (supplierValue.length > 0 && derived.source === "inferred") {
      issues.push({
        code: "invented_protected_fact",
        field: derived.field,
        message: `Supplier already provided ${derived.field}; inferred override rejected.`,
      });
    }

    const kind = CATALOGUE_IMPORT_COLUMN_KIND[derived.field];
    const valueSlug = slugify(derived.value);
    if (
      !params.taxonomy.isKnownConcept(kind, derived.value) &&
      !params.taxonomy.isKnownConcept(kind, valueSlug)
    ) {
      issues.push({
        code: "unknown_taxonomy",
        field: derived.field,
        message: `Unknown ${kind} value "${derived.value}" — will require review if accepted.`,
      });
    }
  }

  const blocking = issues.filter((issue) => issue.code !== "unknown_taxonomy");
  if (blocking.length > 0) {
    return { ok: false, issues: blocking };
  }

  return { ok: true, proposal: parsed.data };
}

const DERIVED_FIELD_TO_PRODUCT_KEY: Readonly<
  Record<CatalogueImportCategoryColumn, keyof CatalogueImportProposedProduct>
> = {
  garment_type: "garmentType",
  mill: "mill",
  collection: "collection",
  season: "season",
  colour: "colour",
  weave: "weave",
  pattern: "pattern",
  construction: "construction",
  fit: "fit",
  formality: "formality",
  occasion: "occasion",
  climate: "climate",
  performance: "performance",
  care: "care",
};

function upsertCategoryMapping(
  mappings: CatalogueImportCategoryMapping[],
  params: {
    readonly field: CatalogueImportCategoryColumn;
    readonly rawValue: string;
    readonly conceptSlug: string;
    readonly conceptId?: MetadataConceptId;
    readonly explanation: string;
    readonly mapped: boolean;
  },
): CatalogueImportCategoryMapping[] {
  const withoutField = mappings.filter(
    (mapping) => mapping.rawValue !== params.rawValue,
  );
  return [
    ...withoutField,
    {
      rawValue: params.rawValue,
      mappedConceptSlug: params.conceptSlug,
      ...(params.conceptId ? { mappedConceptId: params.conceptId } : {}),
      status: params.mapped ? "mapped" : "proposed",
      explanation: params.explanation,
    },
  ];
}

/**
 * Merge a validated enrichment proposal into a proposed product. Every
 * inference remains pending review — nothing is auto-accepted.
 */
export function mergeEnrichmentIntoProposedProduct(params: {
  readonly proposedProduct: CatalogueImportProposedProduct;
  readonly proposal: CatalogueImportEnrichmentProposalParsed;
  readonly supplierRow: Readonly<Record<string, string>>;
  readonly taxonomy: CatalogueImportEnrichmentTaxonomyLookup;
}): CatalogueImportEnrichmentMergeResult {
  let proposedProduct = { ...params.proposedProduct };
  let categoryMappings = [...params.proposedProduct.categoryMappings];
  const reviewTasks: CatalogueImportEnrichmentMergeResult["reviewTasks"][number][] =
    [];

  for (const mapping of params.proposal.taxonomyMappings) {
    const rawValue = supplierCell(params.supplierRow, mapping.field);
    const kind = CATALOGUE_IMPORT_COLUMN_KIND[mapping.field];
    const conceptId =
      params.taxonomy.findConceptId(kind, mapping.conceptSlug) ??
      params.taxonomy.findConceptId(kind, slugify(mapping.conceptSlug));
    const mapped = conceptId !== null;
    categoryMappings = upsertCategoryMapping(categoryMappings, {
      field: mapping.field,
      rawValue,
      conceptSlug: mapping.conceptSlug,
      ...(conceptId ? { conceptId } : {}),
      explanation: `AI ${mapping.source} (${Math.round(mapping.confidence * 100)}%): ${mapping.evidence}`,
      mapped,
    });
    reviewTasks.push({
      field: mapping.field,
      proposedValue: `${mapping.conceptSlug} ← ${rawValue}`,
      explanation: mapping.evidence,
      confidence: mapping.confidence,
    });
  }

  for (const derived of params.proposal.derivedSuitability) {
    const kind = CATALOGUE_IMPORT_COLUMN_KIND[derived.field];
    const conceptId =
      params.taxonomy.findConceptId(kind, derived.value) ??
      params.taxonomy.findConceptId(kind, slugify(derived.value));
    const mapped = conceptId !== null;
    categoryMappings = upsertCategoryMapping(categoryMappings, {
      field: derived.field,
      rawValue: derived.value,
      conceptSlug: slugify(derived.value) || derived.value,
      ...(conceptId ? { conceptId } : {}),
      explanation: `AI ${derived.source} (${Math.round(derived.confidence * 100)}%): ${derived.evidence}`,
      mapped,
    });
    reviewTasks.push({
      field: derived.field,
      proposedValue: derived.value,
      explanation: derived.evidence,
      confidence: derived.confidence,
    });

    const productKey = DERIVED_FIELD_TO_PRODUCT_KEY[derived.field];
    proposedProduct = {
      ...proposedProduct,
      [productKey]: derived.value,
    };
  }

  proposedProduct = {
    ...proposedProduct,
    categoryMappings,
  };

  return { proposedProduct, reviewTasks };
}

/** Stable idempotency key for enrichment retries on one import row. */
export function catalogueImportEnrichmentIdempotencyKey(
  importRowId: string,
): string {
  return `catalogue_import_enrichment:${importRowId}`;
}

export const CATALOGUE_IMPORT_ENRICHMENT_JSON_EXAMPLE = {
  taxonomyMappings: [
    {
      field: "garment_type",
      conceptSlug: "jacket",
      confidence: 0.91,
      source: "supplier_text",
      evidence:
        'Supplier product name "Summer hopsack jacket" indicates a jacket garment type.',
    },
    {
      field: "mill",
      conceptSlug: "loro_piana",
      confidence: 0.98,
      source: "supplier_text",
      evidence: 'Supplier mill column is exactly "Loro Piana".',
    },
  ],
  derivedSuitability: [
    {
      field: "climate",
      value: "warm",
      confidence: 0.84,
      source: "derived",
      evidence:
        "230gsm wool hopsack is typically worn in warm-weather tailoring.",
    },
  ],
} as const;

export function listEnrichmentCategoryFields(): readonly CatalogueImportCategoryColumn[] {
  return CATALOGUE_IMPORT_CATEGORY_COLUMNS;
}
