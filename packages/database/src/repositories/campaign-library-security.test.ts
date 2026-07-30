import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730330000_add_versioned_campaign_library.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("campaign library database security contract", () => {
  it("enables RLS and removes anonymous access", () => {
    expect(migration).toContain(
      "alter table public.campaign_library_entries enable row level security",
    );
    expect(migration).toContain(
      "alter table public.campaign_library_versions enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.campaign_library_entries from public, anon/,
    );
  });

  it("keeps library version snapshots immutable", () => {
    expect(migration).toContain(
      "Campaign library version snapshot is immutable",
    );
  });

  it("pins retailer campaigns to a library version id", () => {
    expect(migration).toContain("library_version_id");
    expect(migration).toContain("library_pinned_at");
  });
});
