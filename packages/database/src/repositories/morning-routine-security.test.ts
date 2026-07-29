import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730190000_add_morning_routine_selection.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("morning routine database security contract", () => {
  it("enables RLS and removes anonymous Data API access", () => {
    expect(migration).toContain(
      "alter table public.morning_routine_selections enable row level security",
    );
    expect(migration).toContain(
      "alter table public.morning_routine_recommendations enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.morning_routine_selections from anon/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.morning_routine_recommendations from anon/,
    );
  });

  it("scopes customer and advisor collaboration to the same retailer relationship", () => {
    expect(migration).toContain(
      'create policy "customers read own morning routine selections"',
    );
    expect(migration).toContain(
      'create policy "retailer staff read tenant morning routine selections"',
    );
    expect(migration).toContain(
      'create policy "customers read own morning routine recommendations"',
    );
    expect(migration).toContain(
      'create policy "retailer staff read tenant morning routine recommendations"',
    );
    expect(migration).toContain("c.user_id = (select auth.uid())");
    expect(migration).toContain(
      "(select public.current_retailer_role()) in (\n      'sales_associate', 'manager', 'admin', 'owner'\n    )",
    );
  });

  it("keeps selection writes behind authorized RPCs", () => {
    expect(migration).toContain(
      "grant select on table public.morning_routine_selections",
    );
    expect(migration).toContain(
      "grant select on table public.morning_routine_recommendations",
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all)[^;]*morning_routine_selections[^;]*authenticated/i,
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all)[^;]*morning_routine_recommendations[^;]*authenticated/i,
    );
    expect(migration).toContain(
      "create or replace function public.persist_morning_routine_selection",
    );
    expect(migration).toContain(
      "create or replace function public.mark_morning_routine_review",
    );
    expect(migration).toContain(
      "Not authorized to persist morning routine selection",
    );
    expect(migration).toContain(
      "Not authorized to update morning routine selection",
    );
  });

  it("stores consent and provider provenance on selections", () => {
    expect(migration).toContain("personalization_consent");
    expect(migration).toContain("location_consent");
    expect(migration).toContain("weather_status");
    expect(migration).toContain("calendar_status");
    expect(migration).toContain("location_kind");
    expect(migration).toContain("'skipped_no_consent'");
  });
});
