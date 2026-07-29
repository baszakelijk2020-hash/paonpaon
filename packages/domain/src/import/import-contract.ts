import type { MetadataConceptKind } from "../metadata/metadata";

import { CATALOGUE_IMPORT_CONTRACT_VERSION } from "./import";

export interface ImportContractField {
  readonly key: string;
  readonly required: boolean;
  readonly description: string;
}

/** Canonical PAON supplier-ingest columns — shared by CSV header, JSON schema, and future PDF mapping. */
export const CATALOGUE_IMPORT_CONTRACT_FIELDS: readonly ImportContractField[] =
  [
    {
      key: "external_sku",
      required: true,
      description: "Supplier SKU used to match rows and assets",
    },
    {
      key: "name",
      required: true,
      description: "Product display name",
    },
    {
      key: "description",
      required: false,
      description: "Long-form product copy",
    },
    {
      key: "garment_type",
      required: true,
      description: "Garment category label from the supplier sheet",
    },
    {
      key: "price",
      required: true,
      description: "Decimal major-unit price (e.g. 1295.00)",
    },
    {
      key: "currency",
      required: true,
      description: "ISO 4217 currency code",
    },
    {
      key: "primary_image_url",
      required: false,
      description: "Main product image URL",
    },
    {
      key: "swatch_image_url",
      required: false,
      description: "Fabric swatch image URL",
    },
    {
      key: "mill",
      required: false,
      description: "Mill or fabric house name",
    },
    {
      key: "collection",
      required: false,
      description: "Fabric collection or season line",
    },
    {
      key: "composition",
      required: false,
      description: "Supplier composition string (review maps to concepts)",
    },
    {
      key: "weight_gsm",
      required: false,
      description: "Fabric weight in grams per square metre",
    },
    {
      key: "season",
      required: false,
      description: "Season label",
    },
    {
      key: "colour",
      required: false,
      description: "Colour label",
    },
    {
      key: "supplier_reference",
      required: false,
      description: "Secondary supplier reference for asset matching",
    },
    {
      key: "weave",
      required: false,
      description: "Weave label",
    },
    {
      key: "pattern",
      required: false,
      description: "Pattern label",
    },
    {
      key: "construction",
      required: false,
      description: "Construction label",
    },
    {
      key: "fit",
      required: false,
      description: "Fit label",
    },
    {
      key: "formality",
      required: false,
      description: "Formality label",
    },
    {
      key: "occasion",
      required: false,
      description: "Occasion label",
    },
    {
      key: "climate",
      required: false,
      description: "Climate suitability label",
    },
    {
      key: "performance",
      required: false,
      description: "Performance label",
    },
    {
      key: "care",
      required: false,
      description: "Care instruction label",
    },
  ] as const;

export const REQUIRED_IMPORT_FIELD_KEYS =
  CATALOGUE_IMPORT_CONTRACT_FIELDS.filter((field) => field.required).map(
    (field) => field.key,
  );

export const OPTIONAL_IMPORT_FIELD_KEYS =
  CATALOGUE_IMPORT_CONTRACT_FIELDS.filter((field) => !field.required).map(
    (field) => field.key,
  );

export const IMPORT_FIELD_ALIASES: Readonly<Record<string, string>> = {
  sku: "external_sku",
  externalSku: "external_sku",
  product_name: "name",
  productName: "name",
  garmentType: "garment_type",
  primaryImageUrl: "primary_image_url",
  swatchImageUrl: "swatch_image_url",
  weightGsm: "weight_gsm",
  supplierReference: "supplier_reference",
  color: "colour",
};

const CONCEPT_FIELD_KIND_MAP: Readonly<Record<string, MetadataConceptKind>> = {
  garment_type: "garment_type",
  mill: "mill",
  collection: "fabric_collection",
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

export function conceptKindForImportField(
  fieldKey: string,
): MetadataConceptKind | null {
  return CONCEPT_FIELD_KIND_MAP[fieldKey] ?? null;
}

export function normalizeImportFieldKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed in IMPORT_FIELD_ALIASES) {
    return IMPORT_FIELD_ALIASES[trimmed]!;
  }
  return trimmed
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

export function buildCsvTemplate(): string {
  const headers = CATALOGUE_IMPORT_CONTRACT_FIELDS.map((field) => field.key);
  return `${headers.join(",")}\n`;
}

export function buildJsonContractSchema(): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    contractVersion: {
      type: "string",
      const: CATALOGUE_IMPORT_CONTRACT_VERSION,
    },
    sourceType: {
      type: "string",
      enum: ["csv", "xlsx", "json", "pdf"],
    },
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(
          CATALOGUE_IMPORT_CONTRACT_FIELDS.map((field) => [
            field.key,
            field.required
              ? { type: "string", minLength: 1 }
              : { type: "string" },
          ]),
        ),
        required: REQUIRED_IMPORT_FIELD_KEYS,
      },
    },
  };

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "PAON catalogue import contract",
    type: "object",
    additionalProperties: false,
    properties,
    required: ["contractVersion", "sourceType", "rows"],
  };
}
