import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730230000_add_concierge_service_plans.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("concierge service plans database security contract", () => {
  it("enables RLS and removes anonymous access on all service tables", () => {
    for (const table of [
      "service_plans",
      "service_memberships",
      "service_entitlements",
      "service_entitlement_entries",
      "service_bookings",
      "service_fulfilment_events",
      "service_care_records",
      "service_cost_records",
      "service_history_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(`revoke all on table public\\.${table} from anon`),
      );
    }
  });

  it("keeps entitlements non-monetary and excludes payment primitives", () => {
    expect(migration).toContain("never stored value or tender");
    expect(migration).toContain("not payment, custody, or stored value");
    expect(migration).not.toMatch(/payment_intent|stripe|stored_value/i);
    expect(migration).toContain("service_entitlement_entries_idempotency_uidx");
  });

  it("exposes operational RPCs with tenant staff or customer auth", () => {
    for (const rpc of [
      "enroll_service_membership",
      "grant_service_entitlement",
      "request_service_booking",
      "transition_service_booking",
      "link_service_booking_appointment",
      "record_service_fulfilment",
      "record_service_care",
      "record_service_cost",
      "set_service_membership_status",
      "assign_service_advisor",
    ]) {
      expect(migration).toContain(`create or replace function public.${rpc}`);
      expect(migration).toContain(`grant execute on function public.${rpc}`);
    }
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("current_retailer_id()");
  });

  it("composes appointments and alterations without order status overload", () => {
    expect(migration).toContain("appointment_id");
    expect(migration).toContain("alteration_id");
    expect(migration).toContain("not order statuses");
    expect(migration).toContain("link_service_booking_appointment");
    expect(migration).toContain("Appointment must match booking retailer");
  });

  it("scopes customer and retailer reads by tenant relationship", () => {
    expect(migration).toContain("customers read own service memberships");
    expect(migration).toContain("customers read own service bookings");
    expect(migration).toContain("retailer staff read tenant service plans");
    expect(migration).toContain("customers read active tenant service plans");
  });
});
