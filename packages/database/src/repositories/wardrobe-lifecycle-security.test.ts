import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730180000_add_wardrobe_lifecycle_fit_freshness.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("wardrobe lifecycle database security contract", () => {
  it("enables RLS and removes anonymous Data API access", () => {
    expect(migration).toContain(
      "alter table public.wardrobe_lifecycle_events enable row level security",
    );
    expect(migration).toContain(
      "alter table public.wardrobe_self_scans enable row level security",
    );
    expect(migration).toContain(
      "alter table public.wardrobe_attachments enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.wardrobe_lifecycle_events from anon/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.wardrobe_self_scans from anon/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.wardrobe_attachments from anon/,
    );
  });

  it("scopes customer and advisor collaboration to the same retailer relationship", () => {
    expect(migration).toContain(
      'create policy "customers read own wardrobe lifecycle events"',
    );
    expect(migration).toContain(
      'create policy "retailer staff read tenant wardrobe lifecycle events"',
    );
    expect(migration).toContain(
      'create policy "customers read own wardrobe self scans"',
    );
    expect(migration).toContain(
      'create policy "retailer staff read tenant wardrobe self scans"',
    );
    expect(migration).toContain("c.user_id = (select auth.uid())");
    expect(migration).toContain(
      "(select public.current_retailer_role()) in (\n      'sales_associate', 'manager', 'admin', 'owner'\n    )",
    );
  });

  it("keeps lifecycle and self-scan history append-only for authenticated clients", () => {
    expect(migration).toContain(
      "grant select on table public.wardrobe_lifecycle_events",
    );
    expect(migration).toContain(
      "grant select on table public.wardrobe_self_scans",
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all)[^;]*wardrobe_lifecycle_events[^;]*authenticated/i,
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all)[^;]*wardrobe_self_scans[^;]*authenticated/i,
    );
    expect(migration).toContain(
      "create or replace function public.record_wardrobe_lifecycle_event",
    );
    expect(migration).toContain(
      "create or replace function public.submit_wardrobe_self_scan",
    );
  });

  it("uses a private wardrobe-evidence bucket with secure object paths", () => {
    expect(migration).toContain("'wardrobe-evidence'");
    expect(migration).toContain("false,");
    expect(migration).toContain(
      "create or replace function public.can_access_wardrobe_storage_object",
    );
    expect(migration).toContain(
      "Wardrobe attachment path must be retailerId/wardrobeItemId/…",
    );
    expect(migration).toContain(
      "Wardrobe attachments must use the wardrobe-evidence bucket",
    );
    expect(migration).toContain(
      'create policy "authorized wardrobe actors can read evidence objects"',
    );
    expect(migration).toContain(
      "uploaders can remove unregistered wardrobe evidence objects",
    );
  });

  it("separates self-scan provenance from official fitting observations", () => {
    expect(migration).toContain("provenance = 'self_reported'");
    expect(migration).toContain("Never inserts into fitting_observations");
    expect(migration).toContain(
      "this function must never touch fitting_observations",
    );
    expect(migration).not.toMatch(/insert into public\.fitting_observations/i);
    expect(migration).toContain("'alteration_fitting'");
    expect(migration).toContain("'fit_update_appointment'");
  });

  it("gates self-scan eligibility to order-line, garment, or purchase", () => {
    expect(migration).toContain(
      "create or replace function public.wardrobe_item_self_scan_eligible",
    );
    expect(migration).toContain("p_item.order_line_id is not null");
    expect(migration).toContain("p_item.physical_garment_id is not null");
    expect(migration).toContain("p_item.ownership_kind = 'retailer_purchased'");
  });
});
