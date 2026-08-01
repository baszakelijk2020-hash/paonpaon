import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260801000007_add_measurement_monitor_gate.sql",
    import.meta.url,
  ),
  "utf8",
);

const repository = readFileSync(
  new URL("./measurement-monitor-repository.ts", import.meta.url),
  "utf8",
);

function tableBody(name: string): string {
  const start = migration.indexOf(
    `create table if not exists public.${name} (`,
  );
  expect(start).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf("\n);", start));
}

describe("PHASE 12.1 measurement gate security contract", () => {
  it("grants no UPDATE or DELETE on approved measurements to any role", () => {
    // "Never silently overwrite approved measurements" as a grant, not a
    // convention. A correction is a new version; there is no statement in
    // this migration that could edit one, even as service_role.
    expect(migration).toContain(
      "grant insert on table public.customer_measurement_versions\n  to authenticated, service_role;",
    );
    expect(migration).not.toMatch(
      /grant[^;]*\b(update|delete)\b[^;]*on table public\.customer_measurement_versions/,
    );
    expect(migration).not.toMatch(
      /create policy[^;]*customer_measurement_versions[^;]*for (update|delete)/,
    );
  });

  it("enables RLS and revokes anon on both tables", () => {
    for (const table of [
      "customer_measurement_versions",
      "customer_measurement_candidates",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(migration).toContain(
        `revoke all on table public.${table} from public, anon;`,
      );
    }
  });

  it("cascades candidate deletion from the source scan but not approved versions", () => {
    // The deletion recompute. Removing a capture removes what was derived
    // from it; an approved version survives because a garment may already
    // have been cut to it.
    expect(tableBody("customer_measurement_candidates")).toContain(
      "self_scan_id uuid references public.wardrobe_self_scans (id) on delete cascade",
    );
    expect(tableBody("customer_measurement_versions")).not.toContain(
      "wardrobe_self_scans",
    );
  });

  it("refuses a comparison decision on a failed-quality scan", () => {
    expect(tableBody("customer_measurement_candidates")).toContain(
      "constraint measurement_candidate_quality_decision check (\n    quality_passed or decision = 'remeasure'\n  )",
    );
  });

  it("requires a named advisor on every approved version", () => {
    const body = tableBody("customer_measurement_versions");
    expect(body).toContain("approved_by_staff_id uuid not null");
    const start = migration.indexOf(
      "create policy customer_measurement_versions_advisor_insert",
    );
    expect(migration.slice(start, migration.indexOf(";", start))).toContain(
      "m.user_id = (select auth.uid())",
    );
  });

  it("keeps body measurements away from the read_only role", () => {
    // Among the more sensitive things this system holds about a person.
    const start = migration.indexOf(
      "create policy customer_measurement_versions_staff_select",
    );
    const body = migration.slice(start, migration.indexOf(";", start));
    expect(body).toContain("('owner', 'manager', 'admin', 'sales_associate')");
    expect(body).not.toContain("read_only");
  });

  it("lets a customer read their own measurements", () => {
    expect(migration).toContain(
      "create policy customer_measurement_versions_own_select",
    );
    expect(migration).toContain("public.customer_account_links");
  });

  it("offers no repository method that approves a candidate wholesale", () => {
    // Making the advisor restate the values they signed off is the
    // difference between review and a rubber stamp.
    //
    // Scans CODE only. The module's own docblock says "there is no
    // approveCandidate(candidateId) on this class" — parentheses and all —
    // so both a substring scan and a call-shape scan would flag the
    // sentence that explains the absence. Made this exact mistake twice on
    // this branch already (the recognition no-leaderboard guard, then this
    // one), which is why the comment strip is here rather than a cleverer
    // regex.
    const code = repository
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(
      /\b(approveCandidate|autoApprove|applyCandidate)\s*\(/,
    );
    expect(code).toMatch(/async\s+recordApprovedVersion\s*\(/);
  });
});
