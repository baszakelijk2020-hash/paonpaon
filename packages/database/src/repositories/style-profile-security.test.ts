import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730140000_add_style_profile_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("style profile database security contract", () => {
  it("enables RLS and removes anonymous Data API access", () => {
    expect(migration).toContain(
      "alter table public.customer_style_profiles enable row level security",
    );
    expect(migration).toContain(
      "alter table public.customer_style_preference_evidence enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.customer_style_profiles from anon/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.customer_style_preference_evidence from anon/,
    );
  });

  it("keeps explicit and inferred preferences on separate columns", () => {
    expect(migration).toContain("explicit_preferences jsonb");
    expect(migration).toContain("inferred_preferences jsonb");
  });

  it("scopes advisor reads to same retailer with personalization consent", () => {
    expect(migration).toContain(
      "retailer staff read tenant style profiles with consent",
    );
    expect(migration).toContain("personalization_opt_in = true");
    expect(migration).toContain("personalization_withdrawn_at is null");
  });

  it("soft-removes inference evidence without deleting rows", () => {
    expect(migration).toContain("removed_at timestamptz");
    expect(migration).toContain(
      "create or replace function public.remove_style_preference_evidence",
    );
    expect(migration).toContain("set removed_at = now()");
  });

  it("exposes recompute and evidence RPCs with authenticated execute grants", () => {
    expect(migration).toContain(
      "create or replace function public.recompute_customer_style_profile",
    );
    expect(migration).toContain(
      "grant execute on function public.recompute_customer_style_profile",
    );
    expect(migration).toContain(
      "grant execute on function public.set_explicit_style_preference",
    );
    expect(migration).toContain(
      "grant execute on function public.record_style_evidence_from_interaction",
    );
  });
});
