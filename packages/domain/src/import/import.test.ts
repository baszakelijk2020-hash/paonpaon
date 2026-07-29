import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  CATALOGUE_IMPORT_COLUMNS,
  CATALOGUE_IMPORT_CONTRACT_VERSION,
  CATALOGUE_IMPORT_TEMPLATE_EXAMPLE_ROW,
} from "./import-contract";
import { serializeCsv } from "./import-csv";
import {
  CatalogueImportParseError,
  parseCatalogueImportCsv,
  parseCatalogueImportJson,
  parseCatalogueImportXlsx,
} from "./import-parser";
import { buildCatalogueImportPreview } from "./import-preview";
import {
  buildCatalogueImportTemplateCsv,
  buildCatalogueImportTemplateJson,
  buildCatalogueImportTemplateXlsx,
} from "./import-templates";
import {
  createCatalogueImportInputSchema,
  createCatalogueImportRowInputSchema,
  createMetadataReviewTaskInputSchema,
} from "./import.schema";

function templateCsvWithRows(
  rows: ReadonlyArray<ReadonlyArray<string>>,
): string {
  const header = [...CATALOGUE_IMPORT_COLUMNS];
  return serializeCsv([header, ...rows]);
}

function exampleCells(
  overrides: Partial<
    Record<(typeof CATALOGUE_IMPORT_COLUMNS)[number], string>
  > = {},
): string[] {
  return CATALOGUE_IMPORT_COLUMNS.map(
    (column) =>
      overrides[column] ?? CATALOGUE_IMPORT_TEMPLATE_EXAMPLE_ROW[column],
  );
}

describe("catalogue import contract schemas", () => {
  it("accepts a PDF-ready source type on the persisted job without requiring a PDF parser", () => {
    const parsed = createCatalogueImportInputSchema.parse({
      retailerId: "11111111-1111-4111-8111-111111111111",
      uploadedByStaffId: "22222222-2222-4222-8222-222222222222",
      sourceFilename: "supplier.csv",
      sourceType: "csv",
      rowCount: 1,
    });
    expect(parsed.contractVersion).toBe(CATALOGUE_IMPORT_CONTRACT_VERSION);
    expect(parsed.status).toBe("previewing");
  });

  it("rejects published status defaults on create row input unless explicit", () => {
    const row = createCatalogueImportRowInputSchema.parse({
      importId: "33333333-3333-4333-8333-333333333333",
      retailerId: "11111111-1111-4111-8111-111111111111",
      rowNumber: 2,
      externalSku: "LP-SUM-001",
      rawPayload: { external_sku: "LP-SUM-001" },
      validationErrors: [],
    });
    expect(row.status).toBe("pending");
  });

  it("requires proposedValue on metadata review tasks", () => {
    expect(() =>
      createMetadataReviewTaskInputSchema.parse({
        retailerId: "11111111-1111-4111-8111-111111111111",
        proposedValue: "",
        source: "supplier",
      }),
    ).toThrow();
  });
});

describe("catalogue import parsers", () => {
  it("parses CSV with BOM, CRLF, empty cells, and formula-looking values", () => {
    const body = templateCsvWithRows([
      exampleCells({
        description: "",
        swatch_image_url: "",
        weave: "=CMD|'/c calc'!A0",
      }),
    ]);
    const withBom = `\uFEFF${body.replaceAll("\n", "\r\n")}`;
    const parsed = parseCatalogueImportCsv(withBom);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.cells.description).toBe("");
    expect(parsed.rows[0]!.cells.swatch_image_url).toBe("");
    expect(parsed.rows[0]!.cells.weave).toBe("CMD|'/c calc'!A0");
    expect(
      parsed.issues.some((issue) => issue.code === "formula_injection"),
    ).toBe(true);
  });

  it("rejects malformed CSV with an unclosed quote", () => {
    expect(() => parseCatalogueImportCsv('external_sku,name\n"a,b')).toThrow(
      CatalogueImportParseError,
    );
  });

  it("enforces byte and row size limits", () => {
    expect(() =>
      parseCatalogueImportCsv("external_sku\n", { maxBytes: 5, maxRows: 10 }),
    ).toThrow(/byte limit/);

    const manyRows = templateCsvWithRows(
      Array.from({ length: 3 }, (_, index) =>
        exampleCells({ external_sku: `SKU-${index}` }),
      ),
    );
    expect(() =>
      parseCatalogueImportCsv(manyRows, { maxBytes: 2_000_000, maxRows: 2 }),
    ).toThrow(/row limit/);
  });

  it("parses JSON arrays and rejects non-array roots", () => {
    const json = buildCatalogueImportTemplateJson();
    const parsed = parseCatalogueImportJson(json);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.cells.external_sku).toBe("LP-SUM-001");

    expect(() => parseCatalogueImportJson('{"external_sku":"x"}')).toThrow(
      /array/,
    );
  });

  it("parses XLSX templates generated from the contract", async () => {
    const bytes = buildCatalogueImportTemplateXlsx();
    const parsed = await parseCatalogueImportXlsx(bytes);
    expect(parsed.sourceType).toBe("xlsx");
    expect(parsed.rows[0]!.cells.name).toBe("Summer hopsack jacket");
  });

  it("rejects unknown columns", () => {
    expect(() =>
      parseCatalogueImportCsv("external_sku,name,mystery\nA,B,C\n"),
    ).toThrow(/Unknown column/);
  });
});

describe("catalogue import preview", () => {
  it("explains mappings, duplicates, and never marks rows published", () => {
    const csv = templateCsvWithRows([
      exampleCells(),
      exampleCells({
        external_sku: "LP-SUM-001",
        name: "Duplicate sku row",
      }),
      exampleCells({
        external_sku: "NEW-002",
        name: "Existing slug product",
        garment_type: "overcoat",
        primary_image_url: "https://cdn.example.com/existing.jpg",
      }),
    ]);
    const parseResult = parseCatalogueImportCsv(csv);
    const preview = buildCatalogueImportPreview({
      parseResult,
      sourceFilename: "supplier.csv",
      existing: {
        skus: new Set(["NEW-002"]),
        supplierReferences: new Set(),
        slugs: new Set(["existing-slug-product"]),
        primaryImageUrls: new Set(["https://cdn.example.com/existing.jpg"]),
        productIdsBySku: new Map([
          [
            "NEW-002",
            asId<"ProductId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
          ],
        ]),
      },
      conceptLookup: {
        findByKindAndLabel: (kind, label) =>
          kind === "garment_type" && label === "jacket"
            ? {
                id: asId<"MetadataConceptId">(
                  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                ),
                slug: "jacket",
              }
            : null,
      },
    });

    expect(
      preview.rows.every(
        (row) => row.status === "valid" || row.status === "pending",
      ),
    ).toBe(true);
    expect(
      preview.rows[0]!.proposedProduct?.categoryMappings.some(
        (mapping) => mapping.status === "mapped",
      ),
    ).toBe(true);
    expect(
      preview.rows.some((row) =>
        row.validationErrors.some(
          (issue) => issue.code === "duplicate_in_file",
        ),
      ),
    ).toBe(true);
    expect(
      preview.rows.some((row) =>
        row.validationErrors.some(
          (issue) => issue.code === "duplicate_existing_sku",
        ),
      ),
    ).toBe(true);
    expect(
      preview.rows.some((row) =>
        row.validationErrors.some(
          (issue) => issue.code === "duplicate_existing_image",
        ),
      ),
    ).toBe(true);
    expect(
      preview.rows.some((row) =>
        row.reviewTasks.some((task) => task.field === "garment_type"),
      ),
    ).toBe(true);
    expect(
      preview.rows[0]!.rawPayload.external_sku ??
        preview.rows[0]!.proposedProduct?.externalSku,
    ).toBe("LP-SUM-001");
  });

  it("keeps downloadable templates synchronized with the parser", async () => {
    const csvPreview = buildCatalogueImportPreview({
      parseResult: parseCatalogueImportCsv(buildCatalogueImportTemplateCsv()),
      sourceFilename: "template.csv",
    });
    const jsonPreview = buildCatalogueImportPreview({
      parseResult: parseCatalogueImportJson(buildCatalogueImportTemplateJson()),
      sourceFilename: "template.json",
    });
    const xlsxPreview = buildCatalogueImportPreview({
      parseResult: await parseCatalogueImportXlsx(
        buildCatalogueImportTemplateXlsx(),
      ),
      sourceFilename: "template.xlsx",
    });

    expect(csvPreview.validRowCount).toBe(1);
    expect(jsonPreview.validRowCount).toBe(1);
    expect(xlsxPreview.validRowCount).toBe(1);
  });
});
