import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730310000_add_versioned_workflow_and_familiarity_presets.sql",
    import.meta.url,
  ),
  "utf8",
);

const tables = [
  "workflow_definitions",
  "workflow_definition_versions",
  "workflow_instances",
  "workflow_events",
  "retailer_familiarity_presets",
] as const;

describe("versioned workflow database security contract", () => {
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

  it("scopes retailer reads to current tenant staff roles", () => {
    expect(migration).toContain("retailer_id = public.current_retailer_id()");
    expect(migration).toContain(
      "public.current_retailer_role() in ('owner', 'manager', 'admin', 'sales_associate')",
    );
  });

  it("restricts familiarity preset writes to admin roles", () => {
    expect(migration).toContain("retailer_familiarity_presets_retailer_write");
    expect(migration).toContain(
      "public.current_retailer_role() in ('owner', 'manager', 'admin')",
    );
  });

  it("pins instances to definition versions and forbids cross-tenant binding", () => {
    expect(migration).toContain(
      "Workflow instance definition version does not belong to the retailer",
    );
    expect(migration).toContain("workflow_instances_subject_unique");
  });

  it("seeds appointment workflow v1 and v2 with transition RPC guards", () => {
    expect(migration).toContain("'appointment'");
    expect(migration).toContain("transition_appointment_workflow");
    expect(migration).toContain("ensure_appointment_workflow_instance");
    expect(migration).toContain("appointments_create_workflow_instance_trg");
  });
});
