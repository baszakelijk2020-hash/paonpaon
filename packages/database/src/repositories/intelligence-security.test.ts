import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730130000_add_consent_and_interaction_events.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("consent and interaction-event database security contract", () => {
  it("enables RLS and removes anonymous Data API access on consent history", () => {
    expect(migration).toContain(
      "alter table public.customer_consent_events enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.customer_consent_events from anon/,
    );
    expect(migration).not.toContain("auth.user_metadata");
  });

  it("keeps consent history append-only for authenticated clients", () => {
    expect(migration).toContain(
      "grant select on table public.customer_consent_events",
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all)[^;]*customer_consent_events[^;]*authenticated/i,
    );
    expect(migration).toContain(
      "create or replace function public.set_customer_consent",
    );
  });

  it("separates personalization, marketing, and location purposes", () => {
    expect(migration).toContain("personalization_opt_in");
    expect(migration).toContain("location_opt_in");
    expect(migration).toContain("marketing_opt_in");
    expect(migration).toContain(
      "purpose in ('personalization', 'marketing', 'location')",
    );
  });

  it("fail-closes capture without personalization consent and blocks anonymous persistence", () => {
    expect(migration).toContain("Personalization consent required");
    expect(migration).toContain(
      "Anonymous interaction persistence is not enabled for this jurisdiction",
    );
    expect(migration).toContain(
      "Anonymous session cannot be linked to a customer",
    );
  });

  it("anonymizes personalization signals on withdrawal without durable-record erasure", () => {
    expect(migration).toContain(
      "create or replace function public.anonymize_behavioral_events_for_customer",
    );
    expect(migration).toContain(
      "create or replace function public.anonymize_expired_behavioral_events",
    );
    expect(migration).toContain(
      "if p_purpose = 'personalization' and p_status = 'withdrawn' then",
    );
    expect(migration).toContain("properties = '{}'::jsonb");
  });

  it("scopes advisor reads to the same retailer and usable events for customers", () => {
    expect(migration).toContain(
      'create policy "retailer advisors read behavioral events"',
    );
    expect(migration).toContain(
      'create policy "customers read own usable behavioral events"',
    );
    expect(migration).toContain("anonymized_at is null");
    expect(migration).toContain("retention_expires_at > now()");
  });

  it("revokes and grants the upgraded capture and consent RPCs", () => {
    expect(migration).toContain(
      "revoke all on function public.capture_behavioral_event",
    );
    expect(migration).toContain(
      "grant execute on function public.capture_behavioral_event",
    );
    expect(migration).toContain(
      "revoke all on function public.set_customer_consent",
    );
    expect(migration).toContain(
      "grant execute on function public.set_customer_consent",
    );
  });
});
