import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730140000_add_style_profile_evidence.sql",
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
    expect(migration).not.toContain("auth.user_metadata");
  });

  it("keeps profile and evidence writes behind RPCs for authenticated clients", () => {
    expect(migration).toContain(
      "grant select on table public.customer_style_profiles",
    );
    expect(migration).toContain(
      "grant select on table public.customer_style_preference_evidence",
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all)[^;]*customer_style_profiles[^;]*authenticated/i,
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all)[^;]*customer_style_preference_evidence[^;]*authenticated/i,
    );
    expect(migration).toContain(
      "create or replace function public.upsert_declared_style_preference",
    );
    expect(migration).toContain(
      "create or replace function public.remove_inferred_style_preference",
    );
    expect(migration).toContain(
      "create or replace function public.persist_style_profile_recompute",
    );
  });

  it("separates explicit and inferred preference columns", () => {
    expect(migration).toContain("explicit_preferences jsonb");
    expect(migration).toContain("inferred_preferences jsonb");
    expect(migration).toContain(
      "-- Never overwrite explicit_preferences from this path.",
    );
  });

  it("soft-suppresses inference without deleting evidence history", () => {
    expect(migration).toContain("suppressed_at");
    expect(migration).toContain("suppressed_by");
    expect(migration).toContain("suppressed_by = 'customer'");
    expect(migration).toContain("source <> 'declared'");
  });

  it("scopes advisor reads to the same retailer relationship", () => {
    expect(migration).toContain(
      'create policy "retailer staff read tenant style profiles"',
    );
    expect(migration).toContain(
      'create policy "retailer staff read tenant style evidence"',
    );
    expect(migration).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
    expect(migration).toContain(
      'create policy "customers read own style profiles"',
    );
  });

  it("clears inferred preferences on personalization withdrawal", () => {
    expect(migration).toContain(
      "create or replace function public.suppress_style_evidence_on_withdrawal",
    );
    expect(migration).toContain(
      "suppressed_by = coalesce(suppressed_by, 'withdrawal')",
    );
    expect(migration).toContain("inferred_preferences = '[]'::jsonb");
  });

  it("requires personalization consent for non-declared evidence", () => {
    expect(migration).toContain(
      "Personalization consent required for inferred evidence",
    );
  });
});
