import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730180000_add_wardrobe_lifecycle_and_self_scan.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("wardrobe lifecycle and self-scan database security contract", () => {
  it("enables RLS and removes anonymous access on new tables", () => {
    expect(migration).toContain(
      "alter table public.wardrobe_lifecycle_events enable row level security",
    );
    expect(migration).toContain(
      "alter table public.wardrobe_self_reports enable row level security",
    );
    expect(migration).toContain(
      "alter table public.wardrobe_attachments enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.wardrobe_self_reports from anon/,
    );
  });

  it("uses a private wardrobe storage bucket with path-scoped access", () => {
    expect(migration).toContain("'wardrobe-private'");
    expect(migration).toContain(
      "create or replace function public.can_access_wardrobe_storage_object",
    );
  });

  it("records self reports separately from official fitting observations", () => {
    expect(migration).toContain("customer_self_reported");
    expect(migration).toContain("record_wardrobe_self_report");
    expect(migration).toContain("latest_official_fitting_at");
    expect(migration).not.toMatch(/insert into public\.fitting_observations/i);
  });

  it("scopes lifecycle and self-scan RPCs to the wardrobe relationship", () => {
    expect(migration).toContain("record_wardrobe_lifecycle_event");
    expect(migration).toContain("Not authorized");
    expect(migration).toContain("Order line is not yet eligible for self-scan");
  });
});
