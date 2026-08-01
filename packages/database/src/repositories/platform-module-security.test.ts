import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260801190000_create_platform_module_kernel.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("R0.3 platform module schema", () => {
  it("defines catalogue, plan bundle, retailer state and immutable events", () => {
    for (const table of [
      "platform_modules",
      "subscription_plan_modules",
      "retailer_module_configurations",
      "retailer_module_configuration_events",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("resolves access and jobs at the database boundary", () => {
    expect(migration).toContain(
      "create or replace function public.resolve_retailer_modules",
    );
    expect(migration).toContain(
      "create or replace function public.retailer_module_job_enabled",
    );
    expect(migration).toContain("rs.status in ('active', 'trialing')");
    expect(migration).toContain("configured.state = 'active'");
  });

  it("validates dependencies in the same transaction as configuration", () => {
    expect(migration).toContain(
      "perform public.assert_retailer_module_dependencies(p_retailer_id);",
    );
    expect(migration).toContain("Module %s requires active module %s.");
  });

  it("replaces commercial plan bundles only through a validated RPC", () => {
    expect(migration).toContain(
      "create or replace function public.replace_subscription_plan_modules",
    );
    expect(migration).toContain("A plan must include Platform Core.");
    expect(migration).toContain("Plan module %s requires module %s.");
  });

  it("does not expose helper or trigger functions as RPCs", () => {
    expect(migration).toContain(
      "revoke all on function public.assert_retailer_module_dependencies(uuid)",
    );
    expect(migration).toContain(
      "revoke all on function public.audit_retailer_module_configuration()",
    );
  });
});
