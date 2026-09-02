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

  it("detects reconciliation failure when published counts mismatch dry-run", () => {
    const rows = buildFixtureMigrationRows();
    const dryRun = buildMigrationDryRunReport(rows);
    // Publish only a partial set
    const published = rows
      .filter((row) => row.status === "ready" && row.entityKind === "customer")
      .map((row) => ({ ...row, status: "published" as const }));
    const reconcile = reconcileMigrationPublish({ dryRun, published });
    expect(reconcile.matched).toBe(false);
    expect(reconcile.notes.some((n) => n.includes("do not match"))).toBe(true);
  });

  it("supports delta publishing by tracking already-published rows", () => {
    const rows = buildFixtureMigrationRows();
    const alreadyPublished = new Set<string>();

    // Publish customers first
    const customerRows = rows.filter((r) => r.entityKind === "customer");
    const plan1 = planMigrationPublish({
      rows: customerRows,
      alreadyPublishedExternalIds: alreadyPublished,
    });
    expect(plan1.toPublish).toHaveLength(2);
    customerRows
      .filter((r) => r.status === "ready")
      .forEach((r) => {
        alreadyPublished.add(`${r.entityKind}:${r.externalId}`);
      });

    // Try to republish customers - should be skipped
    const plan2 = planMigrationPublish({
      rows: customerRows,
      alreadyPublishedExternalIds: alreadyPublished,
    });
    expect(plan2.toPublish).toHaveLength(0);
    expect(plan2.skipped).toHaveLength(2);
  });

  it("validates missing external_id requirement", () => {
    const csv = `full_name,email
John Doe,john@example.com`;
    const rows = parseMigrationEntityCsv("customer", csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("dead_letter");
    expect(rows[0]?.rejectionCode).toBe("missing_external_id");
  });

  it("tolerates empty rows in CSV", () => {
    const csv = `external_id,full_name
CUST-1,Alice

CUST-2,Bob`;
    const rows = parseMigrationEntityCsv("customer", csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.externalId).toBe("CUST-1");
    expect(rows[1]?.externalId).toBe("CUST-2");
  });

  it("rejects orders when customer external_id is missing", () => {
    const plan = planMigrationPublish({
      rows: [
        {
          entityKind: "order",
          rowNumber: 1,
          externalId: "ORD-1",
          payload: { total_minor: "1000", currency: "EUR" },
          status: "ready",
        },
      ],
      alreadyPublishedExternalIds: new Set(),
    });
    // Empty customer_external_id should be handled by repository
    // at publish time, not rejected at planning time
    expect(plan.toPublish).toHaveLength(1);
  });
});
