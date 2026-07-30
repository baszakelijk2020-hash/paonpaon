import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730320000_add_staged_file_migration_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

const tables = [
  "migration_jobs",
  "migration_staged_rows",
  "migration_publish_receipts",
] as const;

describe("staged-file migration database security contract", () => {
  it("enables RLS and removes anonymous Data API access", () => {
    for (const table of tables) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(`revoke all on table public\\.${table} from public, anon`),
      );
    }
  });

  it("does not grant authenticated writes", () => {
    for (const table of tables) {
      expect(migration).not.toMatch(
        new RegExp(
          `grant (insert|update|delete|all)[^;]*${table}[^;]*authenticated`,
          "i",
        ),
      );
    }
  });

  it("scopes reads to the current retailer and fails closed on cross-tenant rows", () => {
    expect(migration).toContain("retailer_id = public.current_retailer_id()");
    expect(migration).toContain(
      "Migration staged row does not belong to the retailer",
    );
  });

  it("supports dead-letter, resume, and rollback references", () => {
    expect(migration).toContain("'dead_letter'");
    expect(migration).toContain("rollback_ref");
    expect(migration).toContain("migration_publish_receipts");
  });
});
