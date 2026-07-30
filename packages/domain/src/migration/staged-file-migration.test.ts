import { describe, expect, it } from "vitest";

import {
  buildFixtureMigrationRows,
  buildMigrationDryRunReport,
  parseMigrationEntityCsv,
  planMigrationPublish,
  reconcileMigrationPublish,
  rejectAmbiguousCustomerIdentities,
  STAGED_FILE_MIGRATION_FIXTURE,
} from "./staged-file-migration";

describe("staged-file migration", () => {
  it("builds a realistic multi-entity fixture dry-run", () => {
    const rows = buildFixtureMigrationRows();
    const report = buildMigrationDryRunReport(rows);
    expect(report.counts.customer).toBe(2);
    expect(report.counts.product).toBe(2);
    expect(report.counts.stock).toBe(2);
    expect(report.counts.order).toBe(2);
    expect(report.expectedOrderMoneyMinor).toBe(62800);
    expect(report.expectedStockUnits).toBe(15);
    expect(report.deadLetter).toBe(0);
  });

  it("rejects password and payment credential fields", () => {
    const rows = parseMigrationEntityCsv(
      "customer",
      STAGED_FILE_MIGRATION_FIXTURE.secretCustomersCsv,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("dead_letter");
    expect(rows[0]?.rejectionCode).toBe("secret_field");
  });

  it("rejects ambiguous identity merges", () => {
    const rows = rejectAmbiguousCustomerIdentities(
      parseMigrationEntityCsv(
        "customer",
        STAGED_FILE_MIGRATION_FIXTURE.ambiguousCustomersCsv,
      ),
    );
    expect(rows.filter((row) => row.status === "dead_letter")).toHaveLength(1);
    expect(
      rows.find((row) => row.status === "dead_letter")?.rejectionCode,
    ).toBe("ambiguous_identity");
  });

  it("supports idempotent rerun by skipping already-published ids", () => {
    const rows = buildFixtureMigrationRows();
    const first = planMigrationPublish({
      rows,
      alreadyPublishedExternalIds: new Set(),
    });
    expect(first.toPublish).toHaveLength(8);

    const second = planMigrationPublish({
      rows,
      alreadyPublishedExternalIds: new Set(
        first.toPublish.map((row) => `${row.entityKind}:${row.externalId}`),
      ),
    });
    expect(second.toPublish).toHaveLength(0);
    expect(second.skipped).toHaveLength(8);
  });

  it("reconciles published counts and money with dry-run", () => {
    const rows = buildFixtureMigrationRows();
    const dryRun = buildMigrationDryRunReport(rows);
    const published = rows
      .filter((row) => row.status === "ready")
      .map((row) => ({ ...row, status: "published" as const }));
    const reconcile = reconcileMigrationPublish({ dryRun, published });
    expect(reconcile.matched).toBe(true);
    expect(reconcile.orderMoneyMinor).toBe(62800);
  });
});
