/**
 * Generic staged-file migration cockpit (INT-002 / INT-003 / PHASE 9.1).
 * Extends catalogue-import parsers and the 8.2 source-authority spine.
 * Presets never silently merge ambiguous identities or invent write-back.
 */

import { parseCsvRecords } from "../import/import-csv";

export const MIGRATION_ENTITY_KINDS = [
  "customer",
  "product",
  "stock",
  "order",
] as const;

export type MigrationEntityKind = (typeof MIGRATION_ENTITY_KINDS)[number];

/** Dependency order for publish. */
export const MIGRATION_PUBLISH_ORDER: readonly MigrationEntityKind[] = [
  "customer",
  "product",
  "stock",
  "order",
] as const;

export const MIGRATION_JOB_STATUSES = [
  "uploaded",
  "profiled",
  "mapped",
  "dry_run",
  "publishing",
  "completed",
  "failed",
] as const;

export type MigrationJobStatus = (typeof MIGRATION_JOB_STATUSES)[number];

export const MIGRATION_ROW_STATUSES = [
  "staged",
  "ready",
  "published",
  "dead_letter",
  "skipped",
] as const;

export type MigrationRowStatus = (typeof MIGRATION_ROW_STATUSES)[number];

export const MIGRATION_CONTRACT_VERSION = "staged-file-migration-v1";

const SECRET_FIELD_PATTERN =
  /^(password|passwd|pwd|card_number|cardnumber|cvv|cvc|expiry|payment_token|secret|api_key)$/i;

export interface MigrationStagedRow {
  readonly entityKind: MigrationEntityKind;
  readonly rowNumber: number;
  readonly externalId: string;
  readonly payload: Readonly<Record<string, string>>;
  readonly status: MigrationRowStatus;
  readonly rejectionCode?: string;
  readonly rejectionMessage?: string;
}

export interface MigrationDryRunReport {
  readonly contractVersion: string;
  readonly counts: Readonly<Record<MigrationEntityKind, number>>;
  readonly rejected: number;
  readonly deadLetter: number;
  readonly expectedOrderMoneyMinor: number;
  readonly expectedStockUnits: number;
  readonly issues: readonly string[];
}

export interface MigrationReconcileReport {
  readonly publishedCounts: Readonly<Record<MigrationEntityKind, number>>;
  readonly orderMoneyMinor: number;
  readonly stockUnits: number;
  readonly matched: boolean;
  readonly notes: readonly string[];
}

export function detectSecretFields(
  payload: Readonly<Record<string, string>>,
): readonly string[] {
  return Object.keys(payload).filter((key) => SECRET_FIELD_PATTERN.test(key));
}

export function parseMigrationEntityCsv(
  entityKind: MigrationEntityKind,
  csvText: string,
): MigrationStagedRow[] {
  const records = parseCsvRecords(csvText);
  if (records.length === 0) return [];
  const header = records[0]!.map((cell) => cell.trim());
  const rows: MigrationStagedRow[] = [];

  for (let i = 1; i < records.length; i += 1) {
    const cells = records[i]!;
    if (cells.every((cell) => cell.trim() === "")) continue;
    const payload: Record<string, string> = {};
    header.forEach((key, index) => {
      payload[key] = (cells[index] ?? "").trim();
    });

    const secrets = detectSecretFields(payload);
    if (secrets.length > 0) {
      rows.push({
        entityKind,
        rowNumber: i,
        externalId: payload.external_id || `row-${i}`,
        payload,
        status: "dead_letter",
        rejectionCode: "secret_field",
        rejectionMessage: `Rejected secret/payment fields: ${secrets.join(", ")}`,
      });
      continue;
    }

    const externalId = payload.external_id;
    if (!externalId) {
      rows.push({
        entityKind,
        rowNumber: i,
        externalId: `row-${i}`,
        payload,
        status: "dead_letter",
        rejectionCode: "missing_external_id",
        rejectionMessage: "external_id is required",
      });
      continue;
    }

    rows.push({
      entityKind,
      rowNumber: i,
      externalId,
      payload,
      status: "ready",
    });
  }

  return rows;
}

/**
 * Exact external_id collision across rows of the same entity is a delta
 * candidate; the same email on two different external_ids is ambiguous and
 * must be rejected (no silent merge).
 */
export function rejectAmbiguousCustomerIdentities(
  rows: readonly MigrationStagedRow[],
): MigrationStagedRow[] {
  const emailOwners = new Map<string, string>();
  return rows.map((row) => {
    if (row.entityKind !== "customer" || row.status !== "ready") return row;
    const email = row.payload.email?.toLowerCase();
    if (!email) return row;
    const owner = emailOwners.get(email);
    if (owner && owner !== row.externalId) {
      return {
        ...row,
        status: "dead_letter" as const,
        rejectionCode: "ambiguous_identity",
        rejectionMessage: `Email ${email} maps to multiple external ids (${owner}, ${row.externalId}); refusing silent merge`,
      };
    }
    emailOwners.set(email, row.externalId);
    return row;
  });
}

export function buildMigrationDryRunReport(
  rows: readonly MigrationStagedRow[],
): MigrationDryRunReport {
  const counts: Record<MigrationEntityKind, number> = {
    customer: 0,
    product: 0,
    stock: 0,
    order: 0,
  };
  let rejected = 0;
  let deadLetter = 0;
  let expectedOrderMoneyMinor = 0;
  let expectedStockUnits = 0;
  const issues: string[] = [];

  for (const row of rows) {
    if (row.status === "ready") {
      counts[row.entityKind] += 1;
      if (row.entityKind === "order") {
        expectedOrderMoneyMinor += Number(row.payload.total_minor ?? 0);
      }
      if (row.entityKind === "stock") {
        expectedStockUnits += Number(row.payload.quantity ?? 0);
      }
    } else if (row.status === "dead_letter") {
      deadLetter += 1;
      rejected += 1;
      if (row.rejectionMessage) issues.push(row.rejectionMessage);
    } else if (row.status === "skipped") {
      rejected += 1;
    }
  }

  return {
    contractVersion: MIGRATION_CONTRACT_VERSION,
    counts,
    rejected,
    deadLetter,
    expectedOrderMoneyMinor,
    expectedStockUnits,
    issues,
  };
}

export function reconcileMigrationPublish(args: {
  readonly dryRun: MigrationDryRunReport;
  readonly published: readonly MigrationStagedRow[];
}): MigrationReconcileReport {
  const publishedCounts: Record<MigrationEntityKind, number> = {
    customer: 0,
    product: 0,
    stock: 0,
    order: 0,
  };
  let orderMoneyMinor = 0;
  let stockUnits = 0;

  for (const row of args.published) {
    if (row.status !== "published") continue;
    publishedCounts[row.entityKind] += 1;
    if (row.entityKind === "order") {
      orderMoneyMinor += Number(row.payload.total_minor ?? 0);
    }
    if (row.entityKind === "stock") {
      stockUnits += Number(row.payload.quantity ?? 0);
    }
  }

  const matched =
    publishedCounts.customer === args.dryRun.counts.customer &&
    publishedCounts.product === args.dryRun.counts.product &&
    publishedCounts.stock === args.dryRun.counts.stock &&
    publishedCounts.order === args.dryRun.counts.order &&
    orderMoneyMinor === args.dryRun.expectedOrderMoneyMinor &&
    stockUnits === args.dryRun.expectedStockUnits;

  const notes: string[] = [];
  if (!matched) {
    notes.push("Published counts or money/stock totals do not match dry-run.");
  } else {
    notes.push("Counts and money/stock totals reconcile with dry-run.");
  }

  return {
    publishedCounts,
    orderMoneyMinor,
    stockUnits,
    matched,
    notes,
  };
}

/**
 * Idempotent publish plan: already-published external ids are skipped.
 */
export function planMigrationPublish(args: {
  readonly rows: readonly MigrationStagedRow[];
  readonly alreadyPublishedExternalIds: ReadonlySet<string>;
}): {
  readonly toPublish: MigrationStagedRow[];
  readonly skipped: MigrationStagedRow[];
  readonly deadLetter: MigrationStagedRow[];
} {
  const toPublish: MigrationStagedRow[] = [];
  const skipped: MigrationStagedRow[] = [];
  const deadLetter: MigrationStagedRow[] = [];

  const ordered = MIGRATION_PUBLISH_ORDER.flatMap((kind) =>
    args.rows.filter((row) => row.entityKind === kind),
  );

  for (const row of ordered) {
    if (row.status === "dead_letter") {
      deadLetter.push(row);
      continue;
    }
    const key = `${row.entityKind}:${row.externalId}`;
    if (args.alreadyPublishedExternalIds.has(key)) {
      skipped.push({ ...row, status: "skipped" });
      continue;
    }
    if (row.status === "ready") {
      toPublish.push(row);
    }
  }

  return { toPublish, skipped, deadLetter };
}

export const STAGED_FILE_MIGRATION_FIXTURE = {
  customersCsv: `external_id,full_name,email,phone
CUST-1,Alex Tailor,alex@example.com,+31600000001
CUST-2,Blake Client,blake@example.com,+31600000002
`,
  productsCsv: `external_id,name,sku,price_minor,currency
PROD-1,Navy Suit Jacket,SKU-JKT-1,45000,EUR
PROD-2,White Shirt,SKU-SH-1,8900,EUR
`,
  stockCsv: `external_id,sku,quantity
STOCK-1,SKU-JKT-1,3
STOCK-2,SKU-SH-1,12
`,
  ordersCsv: `external_id,customer_external_id,total_minor,currency,status
ORD-1,CUST-1,53900,EUR,completed
ORD-2,CUST-2,8900,EUR,completed
`,
  /** Ambiguous identity fixture for rejection tests. */
  ambiguousCustomersCsv: `external_id,full_name,email
CUST-A,One,shared@example.com
CUST-B,Two,shared@example.com
`,
  /** Secret field fixture for rejection tests. */
  secretCustomersCsv: `external_id,full_name,password
CUST-X,Secret User,hunter2
`,
} as const;

export function buildFixtureMigrationRows(): MigrationStagedRow[] {
  const rows = [
    ...parseMigrationEntityCsv(
      "customer",
      STAGED_FILE_MIGRATION_FIXTURE.customersCsv,
    ),
    ...parseMigrationEntityCsv(
      "product",
      STAGED_FILE_MIGRATION_FIXTURE.productsCsv,
    ),
    ...parseMigrationEntityCsv("stock", STAGED_FILE_MIGRATION_FIXTURE.stockCsv),
    ...parseMigrationEntityCsv(
      "order",
      STAGED_FILE_MIGRATION_FIXTURE.ordersCsv,
    ),
  ];
  return rejectAmbiguousCustomerIdentities(rows);
}
