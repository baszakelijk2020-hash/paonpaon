import { describe, expect, it } from "vitest";

import { buildCsvTemplate } from "./import-contract";
import { parseImportFile } from "./import-parser";
import { buildImportPreview } from "./import-preview";
import { sanitizeImportCell } from "./import.schema";

describe("import parser", () => {
  it("parses CSV fixtures with quoted commas and formula injection neutralization", async () => {
    const csv = `${buildCsvTemplate()}"=CMD-001","Summer blazer","Lightweight travel jacket","blazer","1295.00","EUR","https://cdn.example/jacket.jpg","https://cdn.example/swatch.jpg","Loro Piana","Summer","Wool","280","SS","Navy","REF-001"`;
    const result = await parseImportFile({
      filename: "supplier.csv",
      bytes: new TextEncoder().encode(csv),
    });

    expect(result.sourceType).toBe("csv");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.rawPayload.external_sku).toBe("CMD-001");
    expect(result.rows[0]?.rawPayload.name).toBe("Summer blazer");
  });

  it("rejects malformed JSON envelopes", async () => {
    const result = await parseImportFile({
      filename: "broken.json",
      bytes: new TextEncoder().encode('{"rows": []}'),
    });
    expect(result.rows).toHaveLength(0);
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });

  it("parses JSON contract envelopes", async () => {
    const payload = {
      contractVersion: "1.0.0",
      sourceType: "json",
      rows: [
        {
          external_sku: "JSON-001",
          name: "City suit",
          garment_type: "suit",
          price: "2100.00",
          currency: "EUR",
        },
      ],
    };
    const result = await parseImportFile({
      filename: "supplier.json",
      bytes: new TextEncoder().encode(JSON.stringify(payload)),
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.rawPayload.external_sku).toBe("JSON-001");
  });

  it("blocks PDF uploads at preview stage", async () => {
    const result = await parseImportFile({
      filename: "line-sheet.pdf",
      bytes: new TextEncoder().encode("%PDF-1.4"),
    });
    expect(result.rows).toHaveLength(0);
    expect(result.parseErrors[0]?.code).toBe("unsupported_stage");
  });
});

describe("import preview", () => {
  it("explains duplicates, concept proposals, and asset matching", async () => {
    const csv = `${buildCsvTemplate()}DUP-001,First jacket,Desc,blazer,995,EUR,,,,,,,,,\nDUP-001,Duplicate jacket,Desc,blazer,995,EUR,,,,,,,,,`;
    const parsed = await parseImportFile({
      filename: "dup.csv",
      bytes: new TextEncoder().encode(csv),
    });

    const preview = buildImportPreview(parsed.rows, {
      existingSkus: new Set(["EXIST-1"]),
      existingSlugs: new Set(),
      conceptsByKind: {
        garment_type: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            slug: "blazer",
            canonicalName: "Blazer",
          },
        ],
      },
    });

    expect(preview.duplicateCount).toBe(2);
    expect(
      preview.rows.some((row) =>
        row.validationErrors.some((error) => error.code === "duplicate_file"),
      ),
    ).toBe(true);

    const validSingle = buildImportPreview(
      [
        {
          rowNumber: 2,
          rawPayload: {
            external_sku: "ASSET-001",
            name: "Travel jacket",
            garment_type: "blazer",
            price: "1295.00",
            currency: "EUR",
          },
        },
      ],
      {
        existingSkus: new Set(),
        existingSlugs: new Set(),
        conceptsByKind: {
          garment_type: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              slug: "blazer",
              canonicalName: "Blazer",
            },
          ],
        },
      },
    );

    expect(validSingle.rows[0]?.proposedProduct?.assets.matchKey).toBe(
      "external_sku",
    );
    expect(
      validSingle.rows[0]?.proposedProduct?.assignments.length,
    ).toBeGreaterThan(0);
  });

  it("flags existing catalogue SKUs without publishing", () => {
    const preview = buildImportPreview(
      [
        {
          rowNumber: 2,
          rawPayload: {
            external_sku: "EXIST-1",
            name: "Existing jacket",
            garment_type: "blazer",
            price: "1000",
            currency: "EUR",
          },
        },
      ],
      {
        existingSkus: new Set(["EXIST-1"]),
        existingSlugs: new Set(),
        conceptsByKind: {},
      },
    );

    expect(preview.validCount).toBe(0);
    expect(preview.rows[0]?.status).toBe("rejected");
    expect(preview.rows[0]?.validationErrors[0]?.code).toBe(
      "duplicate_catalogue",
    );
  });
});

describe("sanitizeImportCell", () => {
  it("strips spreadsheet formula prefixes", () => {
    expect(sanitizeImportCell("=HYPERLINK()")).toBe("HYPERLINK()");
    expect(sanitizeImportCell("+123")).toBe("123");
  });
});
