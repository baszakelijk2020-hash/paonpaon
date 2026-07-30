import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730260000_add_clienteling_opportunities.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("clienteling opportunity database security contract", () => {
  it("enables RLS and removes anonymous access", () => {
    expect(migration).toContain(
      "alter table public.clienteling_opportunities enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.clienteling_opportunities from public, anon/,
    );
  });

  it("restricts writes to retailer sales roles", () => {
    expect(migration).toContain("clienteling_opportunities_retailer_write");
    expect(migration).toContain("'sales_associate'");
    expect(migration).toContain("not in ('workshop_manager', 'worker')");
  });

  it("keeps opportunities draft-by-default with idempotent projector keys", () => {
    expect(migration).toContain("'draft'");
    expect(migration).toContain("clienteling_opportunities_projector_key_uq");
    expect(migration).toContain("sync_clienteling_opportunity_drafts");
    expect(migration).toContain(
      "where clienteling_opportunities.status = 'draft'",
    );
  });

  it("records outcomes with typed links and staff attribution", () => {
    expect(migration).toContain("record_clienteling_opportunity_outcome");
    expect(migration).toContain("outcome_message_id");
    expect(migration).toContain("outcome_appointment_id");
    expect(migration).toContain("outcome_order_id");
    expect(migration).toContain("outcome_staff_id");
  });
});
