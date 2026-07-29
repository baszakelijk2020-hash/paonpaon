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

  it("limits write access to manager roles while preserving platform authority", () => {
    expect(migration).toContain(
      "(select public.current_retailer_role()) in ('manager', 'admin', 'owner')",
    );
    expect(migration).toContain("(select public.is_platform_staff())");
    expect(migration).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
    expect(migration).not.toMatch(
      /current_retailer_role\(\)\) in \([^)]*'worker'/,
    );
  });

  it("enforces cross-tenant references below the repository layer", () => {
    expect(migration).toContain(
      "Catalogue import row does not belong to the retailer",
    );
    expect(migration).toContain(
      "Catalogue import staff does not belong to the retailer",
    );
    expect(migration).toContain(
      "Metadata review task import row does not belong to the retailer",
    );
    expect(migration).toContain(
      "Metadata review task assignment does not belong to the retailer",
    );
    expect(migration).toContain(
      "Metadata review task concept does not belong to the retailer",
    );
    expect(migration).toContain(
      "Metadata review task staff does not belong to the retailer",
    );
  });

  it("keeps source_type PDF-ready without requiring a PDF extractor", () => {
    expect(migration).toContain("'pdf'");
    expect(migration).toContain(
      "create type public.catalogue_import_source_type",
    );
  });
});
