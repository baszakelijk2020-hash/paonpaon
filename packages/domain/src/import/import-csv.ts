import type { CatalogueImportValidationIssue } from "./import";

const FORMULA_INJECTION_PREFIX = /^[=+\-@]/;

export function looksLikeFormulaInjection(value: string): boolean {
  return FORMULA_INJECTION_PREFIX.test(value.trimStart());
}

export function stripFormulaInjectionPrefix(value: string): string {
  const trimmed = value.trimStart();
  if (!FORMULA_INJECTION_PREFIX.test(trimmed)) {
    return value;
  }
  return trimmed.slice(1).trimStart();
}

export function formulaInjectionIssue(
  field: string,
  rawValue: string,
): CatalogueImportValidationIssue {
  return {
    code: "formula_injection",
    severity: "warning",
    field,
    message: `Cell ${field} looks like a spreadsheet formula`,
    explanation: `Raw value "${rawValue.slice(0, 80)}" begins with a formula prefix. The preview stores the text after stripping the leading formula character and never evaluates formulas.`,
  };
}

/**
 * RFC4180-style CSV parse. Handles UTF-8 BOM, CRLF/LF, quoted fields,
 * escaped quotes, and empty cells. Does not evaluate formulas.
 */
export function parseCsvRecords(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;

  while (index < source.length) {
    const char = source[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      index += 1;
      continue;
    }
    if (char === "\r") {
      if (source[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }

  if (inQuotes) {
    throw new Error("Malformed CSV: unclosed quoted field");
  }

  if (field.length > 0 || row.length > 0 || source.endsWith(",")) {
    row.push(field);
    rows.push(row);
  }

  // Drop a trailing empty line produced by a final newline.
  if (
    rows.length > 0 &&
    rows[rows.length - 1]!.length === 1 &&
    rows[rows.length - 1]![0] === ""
  ) {
    rows.pop();
  }

  return rows;
}

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value) || looksLikeFormulaInjection(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function serializeCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n") + "\n";
}
