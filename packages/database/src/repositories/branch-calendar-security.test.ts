import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730270000_add_branch_calendar_and_closeout.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("branch calendar and closeout database security contract", () => {
  it("enables RLS and removes anonymous access on branch tables", () => {
    expect(migration).toContain(
      "alter table public.retailer_branches enable row level security",
    );
    expect(migration).toContain(
      "alter table public.branch_calendar_entries enable row level security",
    );
    expect(migration).toContain(
      "alter table public.appointment_closeouts enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.retailer_branches from public, anon/,
    );
  });

  it("restricts branch calendar writes to managers and above", () => {
    expect(migration).toContain("retailer_branches_manager_write");
    expect(migration).toContain("branch_calendar_entries_manager_write");
    expect(migration).toContain(
      "public.current_retailer_role() in ('manager', 'admin', 'owner')",
    );
  });

  it("allows sales staff to record closeouts but not duplicate them", () => {
    expect(migration).toContain("appointment_closeouts_sales_write");
    expect(migration).toContain(
      "constraint appointment_closeouts_one_per_appointment unique (appointment_id)",
    );
    expect(migration).toContain(
      "create or replace function public.record_appointment_closeout",
    );
  });

  it("requires customer for recurring moments and emits advisor-observed facts", () => {
    expect(migration).toContain(
      "branch_calendar_entries_recurring_customer_chk",
    );
    expect(migration).toContain("'advisor_observed'");
    expect(migration).toContain("'appointment_closeout'");
  });
});
