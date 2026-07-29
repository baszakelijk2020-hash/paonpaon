import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730200000_add_morning_routine_delivery.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("morning routine delivery database security contract", () => {
  it("enables RLS and removes anonymous access", () => {
    expect(migration).toContain(
      "alter table public.morning_routine_subscriptions enable row level security",
    );
    expect(migration).toContain(
      "alter table public.morning_routine_delivery_audits enable row level security",
    );
    expect(migration).toContain(
      "alter table public.morning_routine_eligible_products enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.morning_routine_subscriptions from anon/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.morning_routine_delivery_audits from anon/,
    );
  });

  it("keeps subscription writes and delivery enqueue behind RPCs", () => {
    expect(migration).toContain(
      "create or replace function public.upsert_morning_routine_subscription",
    );
    expect(migration).toContain(
      "create or replace function public.record_morning_routine_delivery_audit",
    );
    expect(migration).toContain(
      "create or replace function public.enqueue_morning_routine_delivery_notification",
    );
    expect(migration).toContain(
      "Not authorized to update morning routine subscription",
    );
    expect(migration).toContain(
      "grant execute on function public.record_morning_routine_delivery_audit",
    );
    expect(migration).toContain("to service_role;");
  });

  it("does not infer marketing consent as MorningRoutine opt-in", () => {
    expect(migration).toContain("independent of marketing consent");
    expect(migration).toContain("opted_in boolean not null default false");
  });

  it("idempotently constrains successful deliveries per customer/day", () => {
    expect(migration).toContain(
      "morning_routine_delivery_audits_success_day_uidx",
    );
    expect(migration).toContain("queued_in_app");
    expect(migration).toContain("queued_email");
  });
});
