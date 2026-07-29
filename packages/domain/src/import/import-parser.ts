import {
  DEFAULT_CATALOGUE_IMPORT_LIMITS,
  type CatalogueImportParseLimits,
  type CatalogueImportParseResult,
  type CatalogueImportParsedRow,
  type CatalogueImportSourceType,
  type CatalogueImportValidationIssue,
} from "./import";
import {
  CATALOGUE_IMPORT_COLUMNS,
  CATALOGUE_IMPORT_CONTRACT_VERSION,
  CATALOGUE_IMPORT_REQUIRED_COLUMNS,
  isCatalogueImportColumn,
  normalizeCatalogueImportHeader,
  type CatalogueImportColumn,
} from "./import-contract";
import {
  formulaInjectionIssue,
  looksLikeFormulaInjection,
  parseCsvRecords,
  stripFormulaInjectionPrefix,
} from "./import-csv";

export class CatalogueImportParseError extends Error {
  constructor(
    message: string,
    readonly issues: readonly CatalogueImportValidationIssue[],
  ) {
    super(message);
    this.name = "CatalogueImportParseError";
  }
}

function emptyCellNormalized(value: string | undefined): string {
  return value === undefined ? "" : value.trim();
}

function assertByteLimit(
  bytes: Uint8Array | ArrayBuffer | string,
  limits: CatalogueImportParseLimits,
): CatalogueImportValidationIssue[] {
  const size =
    typeof bytes === "string"
      ? new TextEncoder().encode(bytes).byteLength
      : bytes instanceof ArrayBuffer
        ? bytes.byteLength
        : bytes.byteLength;
  if (size > limits.maxBytes) {
    return [
      {
        code: "size_limit",
        severity: "error",
        message: `File exceeds the ${limits.maxBytes} byte limit`,
        explanation: `Measured size is ${size} bytes. Reduce the file or split the import before preview.`,
      },
    ];
  }
  return [];
}

function mapHeaderRow(headers: readonly string[]): {
  columns: CatalogueImportColumn[];
  issues: CatalogueImportValidationIssue[];
} {
  const columns: CatalogueImportColumn[] = [];
  const issues: CatalogueImportValidationIssue[] = [];
  const seen = new Set<string>();

  for (const [index, header] of headers.entries()) {
    const normalized = normalizeCatalogueImportHeader(header);
    if (normalized.length === 0) {
      issues.push({
        code: "malformed_row",
        severity: "error",
        field: `column_${index + 1}`,
        message: "Empty header column",
        explanation:
          "Every header cell must name a PAON import contract field.",
      });
      continue;
    }
    if (!isCatalogueImportColumn(normalized)) {
      issues.push({
        code: "invalid_value",
        severity: "error",
        field: normalized,
        message: `Unknown column "${header}"`,
        explanation: `Column "${normalized}" is not part of contract ${CATALOGUE_IMPORT_CONTRACT_VERSION}.`,
      });
      continue;
    }
    if (seen.has(normalized)) {
      issues.push({
        code: "malformed_row",
        severity: "error",
        field: normalized,
        message: `Duplicate column "${normalized}"`,
        explanation: "Each contract column may appear once in the header row.",
      });
      continue;
    }
    seen.add(normalized);
    columns.push(normalized);
  }

  for (const required of CATALOGUE_IMPORT_REQUIRED_COLUMNS) {
    if (!seen.has(required)) {
      issues.push({
        code: "missing_required",
        severity: "error",
        field: required,
        message: `Missing required column ${required}`,
        explanation: `Contract ${CATALOGUE_IMPORT_CONTRACT_VERSION} requires column "${required}" in the header row.`,
      });
    }
  }

  return { columns, issues };
}

function rowsFromMatrix(
  matrix: readonly (readonly string[])[],
  limits: CatalogueImportParseLimits,
): {
  rows: CatalogueImportParsedRow[];
  issues: CatalogueImportValidationIssue[];
} {
  if (matrix.length === 0) {
    return {
      rows: [],
      issues: [
        {
          code: "malformed_row",
          severity: "error",
          message: "File has no header row",
          explanation: "Import files must start with the PAON contract header.",
        },
      ],
    };
  }

  const { columns, issues: headerIssues } = mapHeaderRow(matrix[0]!);
  if (headerIssues.some((issue) => issue.severity === "error")) {
    return { rows: [], issues: headerIssues };
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length > limits.maxRows) {
    return {
      rows: [],
      issues: [
        ...headerIssues,
        {
          code: "size_limit",
          severity: "error",
          message: `File exceeds the ${limits.maxRows} row limit`,
          explanation: `Measured ${dataRows.length} data rows. Split the file before preview.`,
        },
      ],
    };
  }

  const rows: CatalogueImportParsedRow[] = [];
  const issues: CatalogueImportValidationIssue[] = [...headerIssues];

  for (const [offset, cells] of dataRows.entries()) {
    const rowNumber = offset + 2;
    if (cells.every((cell) => emptyCellNormalized(cell).length === 0)) {
      continue;
    }

    const rawPayload: Record<string, string> = {};
    const normalized: Record<string, string> = {};

    for (const [columnIndex, column] of columns.entries()) {
      const raw = cells[columnIndex] ?? "";
      rawPayload[column] = raw;
      if (looksLikeFormulaInjection(raw)) {
        issues.push(formulaInjectionIssue(column, raw));
        normalized[column] = stripFormulaInjectionPrefix(raw);
      } else {
        normalized[column] = emptyCellNormalized(raw);
      }
    }

    rows.push({
      rowNumber,
      rawPayload,
      cells: normalized,
    });
  }

  return { rows, issues };
}

export function parseCatalogueImportCsv(
  input: string | Uint8Array,
  limits: CatalogueImportParseLimits = DEFAULT_CATALOGUE_IMPORT_LIMITS,
): CatalogueImportParseResult {
  const text =
    typeof input === "string" ? input : new TextDecoder("utf-8").decode(input);
  const sizeIssues = assertByteLimit(text, limits);
  if (sizeIssues.length > 0) {
    throw new CatalogueImportParseError(sizeIssues[0]!.message, sizeIssues);
  }

  let matrix: string[][];
  try {
    matrix = parseCsvRecords(text);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Malformed CSV file";
    throw new CatalogueImportParseError(message, [
      {
        code: "malformed_row",
        severity: "error",
        message,
        explanation:
          "CSV must be UTF-8 with a header row and RFC4180 quoting. Fix the file and retry preview.",
      },
    ]);
  }

  const { rows, issues } = rowsFromMatrix(matrix, limits);
  if (issues.some((issue) => issue.severity === "error") && rows.length === 0) {
    throw new CatalogueImportParseError(
      issues.find((issue) => issue.severity === "error")?.message ??
        "Malformed CSV",
      issues,
    );
  }

  return {
    sourceType: "csv",
    contractVersion: CATALOGUE_IMPORT_CONTRACT_VERSION,
    rows,
    issues,
  };
}

export function parseCatalogueImportJson(
  input: string | Uint8Array,
  limits: CatalogueImportParseLimits = DEFAULT_CATALOGUE_IMPORT_LIMITS,
): CatalogueImportParseResult {
  const text =
    typeof input === "string" ? input : new TextDecoder("utf-8").decode(input);
  const sizeIssues = assertByteLimit(text, limits);
  if (sizeIssues.length > 0) {
    throw new CatalogueImportParseError(sizeIssues[0]!.message, sizeIssues);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new CatalogueImportParseError("Malformed JSON file", [
      {
        code: "malformed_row",
        severity: "error",
        message: "Malformed JSON file",
        explanation:
          "JSON imports must be a UTF-8 array of objects keyed by contract columns.",
      },
    ]);
  }

  if (!Array.isArray(parsed)) {
    throw new CatalogueImportParseError("JSON root must be an array", [
      {
        code: "malformed_row",
        severity: "error",
        message: "JSON root must be an array",
        explanation:
          "Wrap supplier products in a JSON array so each element is one import row.",
      },
    ]);
  }

  if (parsed.length > limits.maxRows) {
    throw new CatalogueImportParseError(
      `File exceeds the ${limits.maxRows} row limit`,
      [
        {
          code: "size_limit",
          severity: "error",
          message: `File exceeds the ${limits.maxRows} row limit`,
          explanation: `Measured ${parsed.length} objects. Split the file before preview.`,
        },
      ],
    );
  }

  const header = [...CATALOGUE_IMPORT_COLUMNS];
  const matrix: string[][] = [header];
  const issues: CatalogueImportValidationIssue[] = [];

  for (const [index, item] of parsed.entries()) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new CatalogueImportParseError(
        `Row ${index + 1} must be a JSON object`,
        [
          {
            code: "malformed_row",
            severity: "error",
            message: `Row ${index + 1} must be a JSON object`,
            explanation:
              "Each array element must be an object of string fields.",
          },
        ],
      );
    }
    const record = item as Record<string, unknown>;
    const row: string[] = [];
    for (const column of header) {
      const value = record[column];
      if (value === undefined || value === null) {
        row.push("");
        continue;
      }
      if (typeof value === "string") {
        row.push(value);
        continue;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        row.push(String(value));
        continue;
      }
      issues.push({
        code: "invalid_value",
        severity: "error",
        field: column,
        message: `Row ${index + 1} field ${column} must be a scalar`,
        explanation:
          "Nested objects and arrays are not accepted in import cells.",
      });
      row.push("");
    }
    matrix.push(row);
  }

  const mapped = rowsFromMatrix(matrix, limits);
  return {
    sourceType: "json",
    contractVersion: CATALOGUE_IMPORT_CONTRACT_VERSION,
    rows: mapped.rows,
    issues: [...issues, ...mapped.issues],
  };
}

export async function parseCatalogueImportXlsx(
  input: Uint8Array | ArrayBuffer,
  limits: CatalogueImportParseLimits = DEFAULT_CATALOGUE_IMPORT_LIMITS,
): Promise<CatalogueImportParseResult> {
  const sizeIssues = assertByteLimit(input, limits);
  if (sizeIssues.length > 0) {
    throw new CatalogueImportParseError(sizeIssues[0]!.message, sizeIssues);
  }

  const XLSX = await import("xlsx");
  let workbook: ReturnType<typeof XLSX.read>;
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  try {
    workbook = XLSX.read(bytes, {
      type: "array",
      raw: false,
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
    });
  } catch {
    throw new CatalogueImportParseError("Malformed XLSX file", [
      {
        code: "malformed_row",
        severity: "error",
        message: "Malformed XLSX file",
        explanation:
          "Upload a valid .xlsx workbook whose first sheet uses the PAON header row.",
      },
    ]);
  }

  const sheetName = workbook.SheetNames[0];
  if (sheetName === undefined) {
    throw new CatalogueImportParseError("XLSX workbook has no sheets", [
      {
        code: "malformed_row",
        severity: "error",
        message: "XLSX workbook has no sheets",
        explanation:
          "The first worksheet must contain the import contract header.",
      },
    ]);
  }

  const sheet = workbook.Sheets[sheetName];
  if (sheet === undefined) {
    throw new CatalogueImportParseError("XLSX sheet is unavailable", [
      {
        code: "malformed_row",
        severity: "error",
        message: "XLSX sheet is unavailable",
        explanation: "The first worksheet could not be read.",
      },
    ]);
  }

  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  }) as string[][];

  const normalized = matrix.map((row) =>
    row.map((cell) =>
      cell === undefined || cell === null ? "" : String(cell),
    ),
  );
  const mapped = rowsFromMatrix(normalized, limits);
  if (
    mapped.issues.some((issue) => issue.severity === "error") &&
    mapped.rows.length === 0
  ) {
    throw new CatalogueImportParseError(
      mapped.issues.find((issue) => issue.severity === "error")?.message ??
        "Malformed XLSX",
      mapped.issues,
    );
  }

  return {
    sourceType: "xlsx",
    contractVersion: CATALOGUE_IMPORT_CONTRACT_VERSION,
    rows: mapped.rows,
    issues: mapped.issues,
  };
}

export function detectCatalogueImportSourceType(
  filename: string,
): Exclude<CatalogueImportSourceType, "pdf"> | null {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".json")) return "json";
  return null;
}

export async function parseCatalogueImportFile(params: {
  readonly filename: string;
  readonly bytes: Uint8Array;
  readonly sourceType?: Exclude<CatalogueImportSourceType, "pdf">;
  readonly limits?: CatalogueImportParseLimits;
}): Promise<CatalogueImportParseResult> {
  const sourceType =
    params.sourceType ?? detectCatalogueImportSourceType(params.filename);
  if (sourceType === null) {
    throw new CatalogueImportParseError("Unsupported import file type", [
      {
        code: "invalid_value",
        severity: "error",
        message: "Unsupported import file type",
        explanation:
          "Upload CSV, XLSX, or JSON. PDF extraction is reserved for a later provider without schema redesign.",
      },
    ]);
  }

  const limits = params.limits ?? DEFAULT_CATALOGUE_IMPORT_LIMITS;
  if (sourceType === "csv") {
    return parseCatalogueImportCsv(params.bytes, limits);
  }
  if (sourceType === "json") {
    return parseCatalogueImportJson(params.bytes, limits);
  }
  return parseCatalogueImportXlsx(params.bytes, limits);
}
