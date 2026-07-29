import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730210000_add_campaign_private_offers.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("campaign private offers database security contract", () => {
  it("enables RLS and removes anonymous access", () => {
    expect(migration).toContain(
      "alter table public.campaigns enable row level security",
    );
    expect(migration).toContain(
      "alter table public.campaign_delivery_audits enable row level security",
    );
    expect(migration).toContain(
      "alter table public.campaign_challenge_enrollments enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.campaigns from anon/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.campaign_delivery_audits from anon/,
    );
  });

  it("keeps challenge mutations and delivery enqueue behind RPCs", () => {
    expect(migration).toContain(
      "create or replace function public.enroll_campaign_challenge",
    );
    expect(migration).toContain(
      "create or replace function public.upsert_campaign_challenge_look",
    );
    expect(migration).toContain(
      "create or replace function public.complete_campaign_challenge",
    );
    expect(migration).toContain(
      "create or replace function public.record_campaign_delivery_audit",
    );
    expect(migration).toContain(
      "Not authorized to enroll in campaign challenge",
    );
    expect(migration).toContain(
      "grant execute on function public.record_campaign_delivery_audit",
    );
    expect(migration).toContain("to service_role;");
  });

  it("does not reuse marketing consent for personalization targeting", () => {
    expect(migration).toContain(
      "marketing consent is never inferred as personalization targeting",
    );
    expect(migration).toContain("require_personalization_consent");
    expect(migration).not.toMatch(/marketing_opt_in.*campaign_audience/i);
  });

  it("idempotently constrains successful deliveries and reward grants", () => {
    expect(migration).toContain("campaign_delivery_audits_success_day_uidx");
    expect(migration).toContain("campaign_reward_grants_enrollment_uidx");
    expect(migration).toContain("campaign_completions_enrollment_uidx");
    expect(migration).toContain("reward_cap_per_customer");
  });

  it("requires private authentication paths for customers", () => {
    expect(migration).toContain("customers read active tenant campaigns");
    expect(migration).toContain("customers read own campaign enrollments");
    expect(migration).toContain("auth.uid()");
  });
});
