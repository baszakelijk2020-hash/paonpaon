import { CATALOGUE_IMPORT_CONTRACT_VERSION } from "./import";
import type {
  ImportParseResult,
  ImportValidationIssue,
  ParsedImportRow,
} from "./import";
import {
  buildCsvTemplate,
  CATALOGUE_IMPORT_CONTRACT_FIELDS,
  normalizeImportFieldKey,
} from "./import-contract";
import {
  importJsonEnvelopeSchema,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  normalizeImportRow,
  sanitizeImportCell,
} from "./import.schema";

export interface ParseImportFileInput {
  readonly filename: string;
  readonly bytes: Uint8Array;
}

function extensionOf(filename: string): string {
  const index = filename.lastIndexOf(".");
  if (index === -1) {
    return "";
  }
  return filename.slice(index + 1).toLowerCase();
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function parseIssue(
  field: string,
  code: string,
  message: string,
): ImportValidationIssue {
  return { field, code, message };
}

function parseCsv(content: string): {
  rows: ParsedImportRow[];
  errors: ImportValidationIssue[];
} {
  const errors: ImportValidationIssue[] = [];
  const records = parseCsvRecords(content);
  if (records.length === 0) {
    return {
      rows: [],
      errors: [parseIssue("file", "empty", "The CSV file contains no rows")],
    };
  }

  const headerRow = records[0];
  if (!headerRow) {
    return {
      rows: [],
      errors: [parseIssue("file", "empty", "The CSV file contains no rows")],
    };
  }
  const headers = headerRow.map((cell) => normalizeImportFieldKey(cell));
  const dataRows = records.slice(1);
  const unknownHeaders = headers.filter(
    (header) =>
      header.length > 0 &&
      !CATALOGUE_IMPORT_CONTRACT_FIELDS.some((field) => field.key === header),
  );
  if (unknownHeaders.length > 0) {
    errors.push(
      parseIssue(
        "headers",
        "unknown_columns",
        `Unknown columns will be ignored: ${unknownHeaders.join(", ")}`,
      ),
    );
  }

  const rows: ParsedImportRow[] = [];
  for (let index = 0; index < dataRows.length; index += 1) {
    const cells = dataRows[index]!;
    if (cells.every((cell) => cell.trim().length === 0)) {
      continue;
    }

    const raw: Record<string, string> = {};
    for (let column = 0; column < headers.length; column += 1) {
      const header = headers[column];
      if (!header) {
        continue;
      }
      raw[header] = sanitizeImportCell(cells[column] ?? "");
    }

    rows.push({
      rowNumber: index + 2,
      rawPayload: normalizeImportRow(raw),
    });
  }

  return { rows, errors };
}

function parseCsvRecords(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]!;
    const next = content[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function parseJson(content: string): {
  rows: ParsedImportRow[];
  errors: ImportValidationIssue[];
  contractVersion: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      rows: [],
      errors: [parseIssue("file", "invalid_json", "JSON could not be parsed")],
      contractVersion: CATALOGUE_IMPORT_CONTRACT_VERSION,
    };
  }

  const envelope = importJsonEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) {
    return {
      rows: [],
      errors: envelope.error.issues.map((issue) =>
        parseIssue(issue.path.join(".") || "file", issue.code, issue.message),
      ),
      contractVersion: CATALOGUE_IMPORT_CONTRACT_VERSION,
    };
  }

  const rows = envelope.data.rows.map((row, index) => ({
    rowNumber: index + 1,
    rawPayload: normalizeImportRow(row),
  }));

  return {
    rows,
    errors: [],
    contractVersion: envelope.data.contractVersion,
  };
}

async function parseXlsx(bytes: Uint8Array): Promise<{
  rows: ParsedImportRow[];
  errors: ImportValidationIssue[];
}> {
  const XLSX = await import("xlsx");
  type WorkBook = ReturnType<typeof XLSX.read>;
  let workbook: WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  } catch {
    return {
      rows: [],
      errors: [
        parseIssue("file", "invalid_xlsx", "The workbook could not be read"),
      ],
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      errors: [
        parseIssue("file", "empty_workbook", "The workbook has no sheets"),
      ],
    };
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      rows: [],
      errors: [
        parseIssue("file", "empty_sheet", "The first worksheet is empty"),
      ],
    };
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(
    sheet,
    {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    },
  );

  if (matrix.length === 0) {
    return {
      rows: [],
      errors: [parseIssue("file", "empty", "The worksheet contains no rows")],
    };
  }

  const headerRow = matrix[0]!.map((value) => String(value));
  const headers = headerRow.map((cell) => normalizeImportFieldKey(cell));
  const rows: ParsedImportRow[] = [];

  for (let index = 1; index < matrix.length; index += 1) {
    const cells = matrix[index]!;
    const raw: Record<string, string> = {};
    for (let column = 0; column < headers.length; column += 1) {
      const header = headers[column];
      if (!header) {
        continue;
      }
      raw[header] = sanitizeImportCell(String(cells[column] ?? ""));
    }

    rows.push({
      rowNumber: index + 1,
      rawPayload: normalizeImportRow(raw),
    });
  }

  return { rows, errors: [] };
}

export async function parseImportFile(
  input: ParseImportFileInput,
): Promise<ImportParseResult> {
  if (input.bytes.byteLength > MAX_IMPORT_FILE_BYTES) {
    return {
      sourceType: "csv",
      contractVersion: CATALOGUE_IMPORT_CONTRACT_VERSION,
      rows: [],
      parseErrors: [
        parseIssue(
          "file",
          "too_large",
          `Import files must be at most ${MAX_IMPORT_FILE_BYTES} bytes`,
        ),
      ],
    };
  }

  const extension = extensionOf(input.filename);
  const content = decodeUtf8(input.bytes);

  if (extension === "json") {
    const parsed = parseJson(content);
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      return {
        sourceType: "json",
        contractVersion: parsed.contractVersion,
        rows: [],
        parseErrors: [
          parseIssue(
            "file",
            "too_many_rows",
            `Imports are limited to ${MAX_IMPORT_ROWS} rows`,
          ),
        ],
      };
    }
    return {
      sourceType: "json",
      contractVersion: parsed.contractVersion,
      rows: parsed.rows,
      parseErrors: parsed.errors,
    };
  }

  if (extension === "xlsx" || extension === "xls") {
    const parsed = await parseXlsx(input.bytes);
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      return {
        sourceType: "xlsx",
        contractVersion: CATALOGUE_IMPORT_CONTRACT_VERSION,
        rows: [],
        parseErrors: [
          parseIssue(
            "file",
            "too_many_rows",
            `Imports are limited to ${MAX_IMPORT_ROWS} rows`,
          ),
        ],
      };
    }
    return {
      sourceType: "xlsx",
      contractVersion: CATALOGUE_IMPORT_CONTRACT_VERSION,
      rows: parsed.rows,
      parseErrors: parsed.errors,
    };
  }

  if (extension === "pdf") {
    return {
      sourceType: "pdf",
      contractVersion: CATALOGUE_IMPORT_CONTRACT_VERSION,
      rows: [],
      parseErrors: [
        parseIssue(
          "file",
          "unsupported_stage",
          "PDF extraction is reserved for a later provider; upload CSV, XLSX, or JSON",
        ),
      ],
    };
  }

  const parsed = parseCsv(content);
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return {
      sourceType: "csv",
      contractVersion: CATALOGUE_IMPORT_CONTRACT_VERSION,
      rows: [],
      parseErrors: [
        parseIssue(
          "file",
          "too_many_rows",
          `Imports are limited to ${MAX_IMPORT_ROWS} rows`,
        ),
      ],
    };
  }

  return {
    sourceType: "csv",
    contractVersion: CATALOGUE_IMPORT_CONTRACT_VERSION,
    rows: parsed.rows,
    parseErrors: parsed.errors,
  };
}

export { buildCsvTemplate };
