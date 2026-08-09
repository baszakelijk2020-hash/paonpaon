import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260804120000_add_advisor_capture.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("advisor capture database security contract", () => {
  it("enables RLS and revokes public/anonymous Data API access on both tables", () => {
    for (const table of [
      "advisor_capture_sessions",
      "advisor_capture_bundles",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(`revoke all on table public\\.${table} from public, anon`),
      );
    }
  });

  it("scopes every policy to the caller's own retailer", () => {
    for (const policy of [
      "advisor_capture_sessions_retailer_select",
      "advisor_capture_sessions_retailer_insert",
      "advisor_capture_bundles_retailer_select",
      "advisor_capture_bundles_retailer_insert",
      "advisor_capture_bundles_retailer_update",
    ]) {
      expect(migration).toContain(`create policy ${policy}`);
    }
    expect(migration).toContain("retailer_id = public.current_retailer_id()");
  });

  it("requires a real staff row tied to the caller's own auth identity to insert a session", () => {
    expect(migration).toContain("s.id = advisor_capture_sessions.staff_id");
    expect(migration).toContain("s.user_id = auth.uid()");
    expect(migration).toContain("s.accepted_at is not null");
    expect(migration).toContain("s.deleted_at is null");
  });

  it("never lets a bundle resolve without both a confirming staff member and a timestamp", () => {
    expect(migration).toContain(
      "constraint advisor_capture_bundles_resolution_chk check (",
    );
    expect(migration).toContain(
      "(status = 'proposed' and confirmed_at is null and confirmed_by_staff_id is null)",
    );
    expect(migration).toContain(
      "and confirmed_at is not null\n        and confirmed_by_staff_id is not null",
    );
  });

  it("requires a real, non-empty source excerpt on every proposed bundle", () => {
    expect(migration).toContain(
      "source_excerpt text not null check (char_length(btrim(source_excerpt)) between 1 and 2000)",
    );
  });

  it("never grants delete on either table to any role", () => {
    expect(migration).not.toMatch(
      /grant\s+(all|delete)\s+on table public\.advisor_capture_sessions/,
    );
    expect(migration).not.toMatch(
      /grant\s+(all|delete)\s+on table public\.advisor_capture_bundles/,
    );
  });
});
