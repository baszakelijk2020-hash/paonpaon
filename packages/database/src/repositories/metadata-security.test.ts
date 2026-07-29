import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260729174939_create_metadata_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

const metadataTables = [
  "metadata_concepts",
  "metadata_concept_edges",
  "entity_metadata_assignments",
  "metadata_assignment_reviews",
  "retailer_concept_overrides",
  "product_fabric_profiles",
  "product_fabric_composition",
];

describe("metadata database security contract", () => {
  it("enables RLS and removes anonymous Data API access on every table", () => {
    for (const table of metadataTables) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(
          `revoke all on table[\\s\\S]*public\\.${table}[\\s\\S]*from anon`,
        ),
      );
    }
    expect(migration).not.toContain("auth.user_metadata");
  });

  it("limits tenant management to manager roles while preserving platform authority", () => {
    expect(migration).toContain(
      "(select public.current_retailer_role()) in ('manager', 'admin', 'owner')",
    );
    expect(migration).toContain("(select public.is_platform_staff())");
    expect(migration).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
    expect(migration).toContain(
      "retailer_id is null or retailer_id = (select public.current_retailer_id())",
    );
    expect(migration).not.toMatch(
      /current_retailer_role\(\)\) in \([^)]*'worker'/,
    );
  });

  it("enforces cross-tenant references below the repository layer", () => {
    expect(migration).toContain(
      "Canonical edges may reference canonical concepts only",
    );
    expect(migration).toContain(
      "Metadata concept does not belong to the retailer",
    );
    expect(migration).toContain(
      "Metadata target does not belong to the retailer",
    );
    expect(migration).toContain(
      "Metadata override concept does not belong to the retailer",
    );
    expect(migration).toContain(
      "Fabric profile product does not belong to the retailer",
    );
    expect(migration).toContain(
      "Fabric composition concept does not belong to the retailer",
    );
  });

  it("keeps review history append-only and fabric replacement atomic", () => {
    expect(migration).toContain(
      "create trigger record_metadata_assignment_review_on_write",
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all)[^;]*metadata_assignment_reviews[^;]*authenticated/i,
    );
    expect(migration).toContain(
      "create or replace function public.set_product_fabric_profile",
    );
    expect(migration).toContain(
      "coalesce(auth.jwt() ->> 'role', '') <> 'service_role'",
    );
    expect(migration).not.toContain(
      "current_user not in ('postgres', 'service_role')",
    );
    expect(migration).toContain(
      "revoke all on function public.set_product_fabric_profile",
    );
    expect(migration).toContain(
      "grant execute on function public.set_product_fabric_profile",
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all)[^;]*product_fabric_(profiles|composition)[^;]*authenticated/i,
    );
    expect(migration).toContain(
      "Fabric composition percentages must total exactly 100",
    );
  });
});
