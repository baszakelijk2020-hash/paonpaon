import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730210000_add_campaigns_and_wardrobe_challenge.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("campaign database security contract", () => {
  it("enables RLS and removes anonymous access", () => {
    expect(migration).toContain(
      "alter table public.retailer_campaigns enable row level security",
    );
    expect(migration).toContain(
      "alter table public.campaign_delivery_audits enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.retailer_campaigns from anon/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.campaign_reward_grants from anon/,
    );
  });

  it("keeps campaign writes behind RPCs", () => {
    expect(migration).toContain(
      "create or replace function public.upsert_retailer_campaign",
    );
    expect(migration).toContain(
      "create or replace function public.complete_wardrobe_challenge",
    );
    expect(migration).toContain(
      "grant execute on function public.record_campaign_delivery_audit",
    );
    expect(migration).toContain("to service_role;");
  });

  it("requires personalization consent and caps rewards per customer", () => {
    expect(migration).toContain("requires_personalization_consent");
    expect(migration).toContain(
      "campaign_reward_grants_customer_campaign_unique",
    );
    expect(migration).toContain("reward_cap_per_customer between 1 and 3");
  });

  it("idempotently constrains successful private-offer delivery per day", () => {
    expect(migration).toContain("campaign_delivery_audits_success_day_uidx");
    expect(migration).toContain("where outcome = 'delivered'");
  });
});
