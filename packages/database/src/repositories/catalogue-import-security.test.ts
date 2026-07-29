import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730100000_create_catalogue_import_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

const importTables = [
  "catalogue_imports",
  "catalogue_import_rows",
  "metadata_review_tasks",
];

describe("catalogue import database security contract", () => {
  it("enables RLS and removes anonymous Data API access on every table", () => {
    for (const table of importTables) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(
          `revoke all on table[\\s\\S]*public\\.${table}[\\s\\S]*from anon`,
        ),
      );
    }
  });

  it("limits import management to manager roles within the tenant", () => {
    expect(migration).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
    expect(migration).toContain(
      "(select public.current_retailer_role()) in ('manager', 'admin', 'owner')",
    );
    expect(migration).toContain("status <> 'published'");
  });

  it("enforces cross-tenant references below the repository layer", () => {
    expect(migration).toContain(
      "Import row retailer must match the import job",
    );
    expect(migration).toContain(
      "Import review task does not belong to the retailer",
    );
    expect(migration).toContain(
      "Review task assignment does not belong to the retailer",
    );
  });
});
