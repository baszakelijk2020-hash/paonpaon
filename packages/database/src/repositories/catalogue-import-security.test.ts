import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const foundation = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730100000_create_catalogue_import_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

const publishing = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730110000_add_catalogue_import_publishing.sql",
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
      expect(foundation).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(foundation).toMatch(
        new RegExp(
          `revoke all on table[\\s\\S]*public\\.${table}[\\s\\S]*from anon`,
        ),
      );
    }
  });

  it("limits write access to manager roles while preserving platform authority", () => {
    expect(foundation).toContain(
      "(select public.current_retailer_role()) in ('manager', 'admin', 'owner')",
    );
    expect(foundation).toContain("(select public.is_platform_staff())");
    expect(foundation).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
    expect(foundation).not.toMatch(
      /current_retailer_role\(\)\) in \([^)]*'worker'/,
    );
  });

  it("enforces cross-tenant references below the repository layer", () => {
    expect(foundation).toContain(
      "Catalogue import row does not belong to the retailer",
    );
    expect(foundation).toContain(
      "Catalogue import staff does not belong to the retailer",
    );
    expect(foundation).toContain(
      "Metadata review task import row does not belong to the retailer",
    );
    expect(foundation).toContain(
      "Metadata review task assignment does not belong to the retailer",
    );
    expect(foundation).toContain(
      "Metadata review task concept does not belong to the retailer",
    );
    expect(foundation).toContain(
      "Metadata review task staff does not belong to the retailer",
    );
  });

  it("keeps source_type PDF-ready without requiring a PDF extractor", () => {
    expect(foundation).toContain("'pdf'");
    expect(foundation).toContain(
      "create type public.catalogue_import_source_type",
    );
  });

  it("exposes transactional publish and review RPCs to authenticated managers only", () => {
    expect(publishing).toContain(
      "create or replace function public.publish_catalogue_import_row(",
    );
    expect(publishing).toContain(
      "create or replace function public.review_catalogue_import_task(",
    );
    expect(publishing).toContain("security definer");
    expect(publishing).toContain("set search_path = ''");
    expect(publishing).toContain(
      "grant execute on function public.publish_catalogue_import_row(uuid)",
    );
    expect(publishing).toContain(
      "grant execute on function public.review_catalogue_import_task(",
    );
    expect(publishing).toContain("to authenticated");
    expect(publishing).toContain(
      "Not authorized to publish catalogue import rows",
    );
    expect(publishing).toContain(
      "Resolve %s pending review task(s) before publishing",
    );
    expect(publishing).toContain("already_published");
    expect(publishing).toContain("publish_error");
    expect(publishing).toContain("published_product_id");
    expect(publishing).toContain("published_by_staff_id");
  });

  it("rolls catalogue writes back on failure while retaining publish_error", () => {
    expect(publishing).toContain("exception");
    expect(publishing).toContain("when others then");
    expect(publishing).toContain("publish_failed");
    expect(publishing).toContain("status = 'failed'");
    expect(publishing).not.toContain("unreviewed bulk publish");
  });
});
