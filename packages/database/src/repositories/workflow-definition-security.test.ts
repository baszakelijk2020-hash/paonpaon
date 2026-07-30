import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730310000_add_workflow_and_familiarity_presets.sql",
    import.meta.url,
  ),
  "utf8",
);

const tables = [
  "workflow_definitions",
  "workflow_definition_versions",
  "workflow_instance_bindings",
  "familiarity_presets",
  "retailer_familiarity_settings",
] as const;

describe("workflow definition database security contract", () => {
  it("enables RLS and removes anonymous Data API access on every table", () => {
    for (const table of tables) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(`revoke all on table public\\.${table} from public, anon`),
      );
    }
  });

  it("does not grant authenticated writes on definition and binding tables", () => {
    for (const table of [
      "workflow_definitions",
      "workflow_definition_versions",
      "workflow_instance_bindings",
      "familiarity_presets",
    ] as const) {
      expect(migration).not.toMatch(
        new RegExp(
          `grant (insert|update|delete|all)[^;]*${table}[^;]*authenticated`,
          "i",
        ),
      );
    }
  });

  it("allows retailer managers to update their familiarity preset only", () => {
    expect(migration).toContain(
      "grant insert, update on table public.retailer_familiarity_settings",
    );
    expect(migration).toContain("retailer_familiarity_settings_retailer_write");
  });

  it("keeps definition version snapshots immutable", () => {
    expect(migration).toContain(
      "Workflow definition version snapshot is immutable",
    );
    expect(migration).toContain("enforce_workflow_version_immutability");
  });

  it("scopes instance bindings and settings to the current retailer", () => {
    expect(migration).toContain("retailer_id = public.current_retailer_id()");
    expect(migration).toContain("public.is_platform_staff()");
  });

  it("seeds familiarity presets without forking schemas", () => {
    expect(migration).toContain("paon_recommended");
    expect(migration).toContain("atelier_tailoring");
    expect(migration).toContain("alteration_work_order");
  });
});
