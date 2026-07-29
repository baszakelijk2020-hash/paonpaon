import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730230000_add_concierge_service_plans.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("concierge service database security contract", () => {
  it("enables RLS and removes anonymous access", () => {
    expect(migration).toContain(
      "alter table public.concierge_service_plan_definitions enable row level security",
    );
    expect(migration).toContain(
      "alter table public.concierge_service_bookings enable row level security",
    );
    expect(migration).toContain(
      "alter table public.concierge_service_status_history enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.concierge_service_bookings from anon/,
    );
  });

  it("keeps booking mutations behind RPCs", () => {
    expect(migration).toContain(
      "create or replace function public.enroll_concierge_service",
    );
    expect(migration).toContain(
      "create or replace function public.request_concierge_service_booking",
    );
    expect(migration).toContain(
      "create or replace function public.transition_concierge_service_booking",
    );
    expect(migration).toContain(
      "create or replace function public.consume_concierge_entitlements_for_booking",
    );
    expect(migration).toContain("Not authorized to request concierge booking");
    expect(migration).toContain(
      "grant execute on function public.record_concierge_service_cost",
    );
  });

  it("idempotently constrains entitlement consumption", () => {
    expect(migration).toContain("concierge_entitlement_consumptions_uidx");
    expect(migration).toContain("consumed <= allowance");
  });

  it("separates operational costs from payment collection", () => {
    expect(migration).toContain(
      "Operational concierge cost recording without payment collection",
    );
    expect(migration).not.toMatch(/payment_id/i);
    expect(migration).not.toMatch(/stripe/i);
  });

  it("requires tenant-scoped customer access", () => {
    expect(migration).toContain("customers read own concierge bookings");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("concierge_enrollments_customer_retailer_fk");
  });
});
