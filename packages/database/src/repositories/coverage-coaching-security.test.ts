import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260801000005_add_coverage_ceremony_coaching.sql",
    import.meta.url,
  ),
  "utf8",
);

/** Body of one CREATE TABLE statement, so a guard never matches its own
 * explanatory comment elsewhere in the file — a mistake made once already
 * on this branch. */
function tableBody(name: string): string {
  const start = migration.indexOf(
    `create table if not exists public.${name} (`,
  );
  expect(start).toBeGreaterThan(-1);
  const end = migration.indexOf("\n);", start);
  return migration.slice(start, end);
}

describe("PHASE 11.3 schema security contract", () => {
  it("enables RLS and revokes anon on every new table", () => {
    for (const table of [
      "coverage_plans",
      "coverage_plan_intervals",
      "staff_availability_declarations",
      "staff_shift_swap_requests",
      "service_ceremony_versions",
      "staff_coaching_observations",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(migration).toContain(
        `revoke all on table public.${table} from public, anon;`,
      );
    }
  });

  it("carries retailer_id on every new table", () => {
    for (const table of [
      "coverage_plans",
      "coverage_plan_intervals",
      "staff_availability_declarations",
      "staff_shift_swap_requests",
      "service_ceremony_versions",
      "staff_coaching_observations",
    ]) {
      expect(tableBody(table)).toContain(
        "retailer_id uuid not null references public.retailers (id) on delete cascade",
      );
    }
  });

  it("refuses a self-approved shift swap in the schema, not only in the domain", () => {
    // The domain check is the readable error; this CHECK is the guarantee,
    // because a direct PostgREST call never touches the domain layer.
    const body = tableBody("staff_shift_swap_requests");
    expect(body).toContain(
      "constraint staff_shift_swap_not_self check (requesting_staff_id <> peer_staff_id)",
    );
    expect(body).toMatch(
      /staff_shift_swap_independent_approver[\s\S]*approved_by_staff_id <> requesting_staff_id[\s\S]*approved_by_staff_id <> peer_staff_id/,
    );
  });

  it("refuses a self-observation in the schema", () => {
    expect(tableBody("staff_coaching_observations")).toContain(
      "constraint staff_coaching_not_self check (observed_staff_id <> observer_staff_id)",
    );
  });

  it("keeps coaching records out of general team visibility", () => {
    // Everything else in 11.3 is retailer-wide readable on purpose. A
    // coaching observation is not: the subject and managers only. An
    // observation the whole floor can read is a public performance notice.
    expect(migration).toContain(
      "create policy staff_coaching_subject_or_manager_select",
    );
    expect(migration).not.toContain(
      "create policy staff_coaching_retailer_select",
    );
  });

  it("allows a ceremony version to be edited only while unpublished", () => {
    expect(migration).toMatch(
      /create policy service_ceremony_manager_update_draft[\s\S]*?and published = false/,
    );
  });

  it("pins an availability declaration and a swap request to the calling user", () => {
    for (const policy of [
      "staff_availability_self_insert",
      "staff_shift_swap_requester_insert",
    ]) {
      const start = migration.indexOf(`create policy ${policy}`);
      expect(start).toBeGreaterThan(-1);
      const body = migration.slice(start, migration.indexOf(";", start));
      expect(body).toContain("m.user_id = (select auth.uid())");
    }
  });

  it("exposes no per-person coaching total, average or rank column", () => {
    // Same structural non-goal as 11.2's recognition. Scanning the CREATE
    // TABLE body only, not the comment that explains the absence.
    const body = tableBody("staff_coaching_observations");
    expect(body).not.toMatch(/\b(average|avg|total|rank|score_total|points)\b/);
  });

  it("never assigns a shift from a coverage table", () => {
    // "No fully autonomous scheduling" made structural: coverage states a
    // requirement; public.staff_shifts stays the only truth for who works.
    expect(tableBody("coverage_plans")).not.toContain("staff_shifts");
    expect(tableBody("coverage_plan_intervals")).not.toContain("staff_id");
  });
});
