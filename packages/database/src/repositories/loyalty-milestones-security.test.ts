import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730220000_add_loyalty_tailoring_milestones.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("loyalty tailoring milestones database security contract", () => {
  it("enables RLS and removes anonymous access", () => {
    expect(migration).toContain(
      "alter table public.loyalty_milestone_definitions enable row level security",
    );
    expect(migration).toContain(
      "alter table public.loyalty_milestone_awards enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.loyalty_milestone_definitions from anon/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.loyalty_milestone_awards from anon/,
    );
  });

  it("keeps awards auditable through the loyalty ledger", () => {
    expect(migration).toContain("earn_bonus");
    expect(migration).toContain("adjustment_manual");
    expect(migration).toContain("loyalty_ledger_entry_id");
    expect(migration).toContain("never a second balance");
    expect(migration).not.toMatch(
      /create table public\.loyalty_points_shadow/i,
    );
  });

  it("idempotently constrains awards and syncs from order status", () => {
    expect(migration).toContain("loyalty_milestone_awards_idempotency_uidx");
    expect(migration).toContain("sync_loyalty_milestones_for_order");
    expect(migration).toContain("sync_loyalty_milestones_after_order_status");
    expect(migration).toContain(
      "on conflict (loyalty_account_id, kind, idempotency_key)",
    );
  });

  it("scopes customer and retailer reads by tenant relationship", () => {
    expect(migration).toContain("customers read own loyalty milestone awards");
    expect(migration).toContain("retailer reads loyalty milestone awards");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("current_retailer_id()");
  });

  it("reverses awards on refunded or canceled orders", () => {
    expect(migration).toContain("'canceled', 'refunded'");
    expect(migration).toContain("Milestone correction:");
    expect(migration).toContain("status = 'reversed'");
  });
});
