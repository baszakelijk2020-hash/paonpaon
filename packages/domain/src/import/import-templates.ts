import * as XLSX from "xlsx";

import {
  CATALOGUE_IMPORT_COLUMNS,
  CATALOGUE_IMPORT_CONTRACT_VERSION,
  CATALOGUE_IMPORT_TEMPLATE_EXAMPLE_ROW,
} from "./import-contract";
import { serializeCsv } from "./import-csv";
import { DEFAULT_IMPORT_ENRICHMENT_PROMPT_MARKDOWN } from "./import-enrichment";

export type CatalogueImportTemplateFormat = "csv" | "xlsx" | "json" | "llm";

export function buildCatalogueImportTemplateCsv(): string {
  const header = [...CATALOGUE_IMPORT_COLUMNS];
  const example = CATALOGUE_IMPORT_COLUMNS.map(
    (column) => CATALOGUE_IMPORT_TEMPLATE_EXAMPLE_ROW[column],
  );
  return serializeCsv([header, example]);
}

export function buildCatalogueImportTemplateJson(): string {
  const row: Record<string, string> = {};
  for (const column of CATALOGUE_IMPORT_COLUMNS) {
    row[column] = CATALOGUE_IMPORT_TEMPLATE_EXAMPLE_ROW[column];
  }
  return `${JSON.stringify([row], null, 2)}\n`;
}

export function buildCatalogueImportTemplateXlsx(): Uint8Array {
  const header = [...CATALOGUE_IMPORT_COLUMNS];
  const example = CATALOGUE_IMPORT_COLUMNS.map(
    (column) => CATALOGUE_IMPORT_TEMPLATE_EXAMPLE_ROW[column],
  );
  const sheet = XLSX.utils.aoa_to_sheet([header, example]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "catalogue_import");
  const buffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer;
  return new Uint8Array(buffer);
}

/**
 * Offline / downloadable LLM contract. Prefer the Admin-maintained
 * `import_enrichment_prompt_contracts` row when available; this default
 * remains the fallback and seed source.
 */
export function buildCatalogueImportLlmContract(
  promptMarkdown?: string,
): string {
  return promptMarkdown?.trim() || DEFAULT_IMPORT_ENRICHMENT_PROMPT_MARKDOWN;
}

export function catalogueImportTemplateFilename(
  format: CatalogueImportTemplateFormat,
): string {
  switch (format) {
    case "csv":
      return `paon-catalogue-import-${CATALOGUE_IMPORT_CONTRACT_VERSION}.csv`;
    case "xlsx":
      return `paon-catalogue-import-${CATALOGUE_IMPORT_CONTRACT_VERSION}.xlsx`;
    case "json":
      return `paon-catalogue-import-${CATALOGUE_IMPORT_CONTRACT_VERSION}.json`;
    case "llm":
      return `paon-catalogue-import-llm-contract-${CATALOGUE_IMPORT_CONTRACT_VERSION}.md`;
  }
}

export function catalogueImportTemplateContentType(
  format: CatalogueImportTemplateFormat,
): string {
  switch (format) {
    case "csv":
      return "text/csv; charset=utf-8";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "json":
      return "application/json; charset=utf-8";
    case "llm":
      return "text/markdown; charset=utf-8";
  }
}

export function buildCatalogueImportTemplate(
  format: CatalogueImportTemplateFormat,
  promptMarkdown?: string,
): Uint8Array | string {
  switch (format) {
    case "csv":
      return buildCatalogueImportTemplateCsv();
    case "xlsx":
      return buildCatalogueImportTemplateXlsx();
    case "json":
      return buildCatalogueImportTemplateJson();
    case "llm":
      return buildCatalogueImportLlmContract(promptMarkdown);
  }
}
