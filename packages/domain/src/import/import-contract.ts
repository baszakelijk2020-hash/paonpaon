/**
 * Versioned PAON catalogue import contract (IMP-001 / IMP-004).
 * Downloadable templates and parsers share this single source of truth.
 */

export const CATALOGUE_IMPORT_CONTRACT_VERSION = "v1" as const;

export const CATALOGUE_IMPORT_REQUIRED_COLUMNS = [
  "external_sku",
  "name",
  "description",
  "garment_type",
  "price",
  "currency",
  "primary_image_url",
  "swatch_image_url",
  "mill",
  "collection",
  "composition",
  "weight_gsm",
  "season",
  "colour",
  "supplier_reference",
] as const;

export const CATALOGUE_IMPORT_OPTIONAL_COLUMNS = [
  "weave",
  "pattern",
  "construction",
  "fit",
  "formality",
  "occasion",
  "climate",
  "performance",
  "care",
] as const;

export const CATALOGUE_IMPORT_COLUMNS = [
  ...CATALOGUE_IMPORT_REQUIRED_COLUMNS,
  ...CATALOGUE_IMPORT_OPTIONAL_COLUMNS,
] as const;

export type CatalogueImportColumn = (typeof CATALOGUE_IMPORT_COLUMNS)[number];

export type CatalogueImportRequiredColumn =
  (typeof CATALOGUE_IMPORT_REQUIRED_COLUMNS)[number];

export type CatalogueImportOptionalColumn =
  (typeof CATALOGUE_IMPORT_OPTIONAL_COLUMNS)[number];

/** Columns that map onto catalogue metadata concept kinds for preview. */
export const CATALOGUE_IMPORT_CATEGORY_COLUMNS = [
  "garment_type",
  "mill",
  "collection",
  "season",
  "colour",
  "weave",
  "pattern",
  "construction",
  "fit",
  "formality",
  "occasion",
  "climate",
  "performance",
  "care",
] as const satisfies readonly CatalogueImportColumn[];

export type CatalogueImportCategoryColumn =
  (typeof CATALOGUE_IMPORT_CATEGORY_COLUMNS)[number];

export const CATALOGUE_IMPORT_COLUMN_KIND: Readonly<
  Record<CatalogueImportCategoryColumn, string>
> = {
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

export interface CatalogueImportColumnDefinition {
  readonly name: CatalogueImportColumn;
  readonly required: boolean;
  readonly description: string;
}

export const CATALOGUE_IMPORT_COLUMN_DEFINITIONS: readonly CatalogueImportColumnDefinition[] =
  [
    {
      name: "external_sku",
      required: true,
      description:
        "Supplier SKU or retailer-facing SKU retained as provenance.",
    },
    {
      name: "name",
      required: true,
      description: "Product display name.",
    },
    {
      name: "description",
      required: true,
      description: "Supplier product description (may be empty string).",
    },
    {
      name: "garment_type",
      required: true,
      description: "Garment type label mapped to a catalogue concept.",
    },
    {
      name: "price",
      required: true,
      description: "Unit price as decimal major units (e.g. 1299.00).",
    },
    {
      name: "currency",
      required: true,
      description: "ISO 4217 currency code.",
    },
    {
      name: "primary_image_url",
      required: true,
      description: "Main product image URL for deterministic asset matching.",
    },
    {
      name: "swatch_image_url",
      required: true,
      description: "Fabric swatch image URL (may be empty).",
    },
    {
      name: "mill",
      required: true,
      description: "Mill / mill house supplier label.",
    },
    {
      name: "collection",
      required: true,
      description: "Supplier fabric collection name.",
    },
    {
      name: "composition",
      required: true,
      description: "Exact fibre composition string (e.g. 100% wool).",
    },
    {
      name: "weight_gsm",
      required: true,
      description: "Fabric weight in grams per square metre.",
    },
    {
      name: "season",
      required: true,
      description: "Season suitability label.",
    },
    {
      name: "colour",
      required: true,
      description: "Colour label.",
    },
    {
      name: "supplier_reference",
      required: true,
      description: "Supplier fabric or style reference retained as provenance.",
    },
    {
      name: "weave",
      required: false,
      description: "Optional weave label.",
    },
    {
      name: "pattern",
      required: false,
      description: "Optional pattern label.",
    },
    {
      name: "construction",
      required: false,
      description: "Optional construction label.",
    },
    {
      name: "fit",
      required: false,
      description: "Optional fit label.",
    },
    {
      name: "formality",
      required: false,
      description: "Optional formality label.",
    },
    {
      name: "occasion",
      required: false,
      description: "Optional occasion label.",
    },
    {
      name: "climate",
      required: false,
      description: "Optional climate suitability label.",
    },
    {
      name: "performance",
      required: false,
      description: "Optional performance label.",
    },
    {
      name: "care",
      required: false,
      description: "Optional care label.",
    },
  ];

/** Example row used by downloadable templates and parser fixtures. */
export const CATALOGUE_IMPORT_TEMPLATE_EXAMPLE_ROW: Readonly<
  Record<CatalogueImportColumn, string>
> = {
  external_sku: "LP-SUM-001",
  name: "Summer hopsack jacket",
  description: "Lightweight hopsack for warm-weather tailored looks.",
  garment_type: "jacket",
  price: "1890.00",
  currency: "USD",
  primary_image_url: "https://cdn.example.com/products/lp-sum-001.jpg",
  swatch_image_url: "https://cdn.example.com/swatches/lp-sum-001.jpg",
  mill: "Loro Piana",
  collection: "Summertime",
  composition: "100% wool",
  weight_gsm: "230",
  season: "summer",
  colour: "navy",
  supplier_reference: "LP-ST-230-NV",
  weave: "hopsack",
  pattern: "solid",
  construction: "soft",
  fit: "regular",
  formality: "smart_casual",
  occasion: "travel",
  climate: "warm",
  performance: "breathable",
  care: "dry_clean",
};

/**
 * Offline LLM documentation contract (IMP-004). Kept in-domain so the
 * Retailer Portal can download it alongside CSV/XLSX/JSON templates.
 */
export const CATALOGUE_IMPORT_LLM_CONTRACT_MARKDOWN = `# PAON catalogue import LLM contract (${CATALOGUE_IMPORT_CONTRACT_VERSION})

Use this prompt offline with ChatGPT or a compatible model. Do not invent
mills, composition percentages, construction, or other protected supplier
facts. Return only schema-valid CSV or JSON matching the columns below.

## Required columns
${CATALOGUE_IMPORT_REQUIRED_COLUMNS.map((column) => `- \`${column}\``).join("\n")}

## Optional columns
${CATALOGUE_IMPORT_OPTIONAL_COLUMNS.map((column) => `- \`${column}\``).join("\n")}

## Rules
1. Preserve supplier SKU and supplier_reference exactly.
2. Keep raw supplier wording in descriptive fields.
3. Map known taxonomy terms to lowercase snake_case labels when confident.
4. Leave unknown terms as the supplier string so PAON can create review tasks.
5. Never invent mill, composition, weight_gsm, or construction.
6. Output must be UTF-8 CSV or a JSON array of objects using these keys.
7. PDF extracts must eventually emit this same row shape without schema redesign.

---

## AI-assisted enrichment response (IMP-003)

When PAON asks for **enrichment** of an already-parsed supplier row, respond
with a single JSON object (not CSV) using this exact shape:

\`\`\`json
{
  "taxonomyMappings": [
    {
      "field": "garment_type",
      "conceptSlug": "jacket",
      "confidence": 0.91,
      "source": "supplier_text",
      "evidence": "Quote or paraphrase the supplier text that supports the mapping."
    }
  ],
  "derivedSuitability": [
    {
      "field": "climate",
      "value": "warm",
      "confidence": 0.84,
      "source": "derived",
      "evidence": "Explain why this suitability follows from accepted supplier facts."
    }
  ]
}
\`\`\`

### Enrichment rules
1. \`taxonomyMappings.field\` must be one of the category columns listed above.
2. \`mill\` and \`construction\` mappings must use \`source: "supplier_text"\` and match the supplier cell exactly — never infer a different mill or construction.
3. Never include protected facts (\`external_sku\`, \`composition\`, \`weight_gsm\`, \`supplier_reference\`, prices, URLs) in \`derivedSuitability\`.
4. Every inference must include \`confidence\` between 0 and 1 and non-empty \`evidence\`.
5. Use lowercase snake_case \`conceptSlug\` values that exist in the retailer taxonomy when possible; unknown slugs remain pending human review.
6. Do not auto-publish — PAON stores every inference as a pending review task.
`;

export function isCatalogueImportColumn(
  value: string,
): value is CatalogueImportColumn {
  return (CATALOGUE_IMPORT_COLUMNS as readonly string[]).includes(value);
}

export function normalizeCatalogueImportHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}
