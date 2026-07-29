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
  it("enables RLS and removes anonymous table access", () => {
    expect(migration).toContain(
      "alter table public.morning_routine_subscriptions enable row level security",
    );
    expect(migration).toContain(
      "alter table public.morning_routine_deliveries enable row level security",
    );
    expect(migration).toContain(
      "alter table public.morning_routine_retailer_settings enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.morning_routine_subscriptions from anon/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.morning_routine_deliveries from anon/,
    );
  });

  it("scopes customer subscription writes to the owning relationship", () => {
    expect(migration).toContain(
      'create policy "customers manage own morning routine subscriptions"',
    );
    expect(migration).toContain("c.user_id = (select auth.uid())");
  });

  it("restricts retailer settings to managers and keeps delivery audit service-only writes", () => {
    expect(migration).toContain(
      'create policy "retailer managers manage morning routine retailer settings"',
    );
    expect(migration).toContain(
      "grant execute on function public.record_morning_routine_delivery",
    );
    expect(migration).toContain("to service_role");
    expect(migration).not.toMatch(
      /grant execute on function public\.record_morning_routine_delivery[^;]*authenticated/i,
    );
  });

  it("adds auditable idempotent delivery rows and explicit unsubscribe RPC", () => {
    expect(migration).toContain(
      "unique (retailer_id, customer_id, for_date, channel)",
    );
    expect(migration).toContain(
      "create or replace function public.unsubscribe_morning_routine_by_token",
    );
    expect(migration).toContain(
      "create or replace function public.enqueue_morning_routine_email",
    );
  });
});
