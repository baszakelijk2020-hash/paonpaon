import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730340000_add_seven_day_and_honeymoon_packages.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("seven-day and honeymoon database security contract", () => {
  it("enables RLS on honeymoon tables and removes anonymous access", () => {
    expect(migration).toContain(
      "alter table public.honeymoon_programmes enable row level security",
    );
    expect(migration).toContain(
      "alter table public.honeymoon_programme_actions enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.honeymoon_programmes from public, anon/,
    );
  });

  it("forbids payment-approval claims on honeymoon actions", () => {
    expect(migration).toContain(
      "check (requires_payment_approval = false)",
    );
  });

  it("widens campaign library keys for seven-day and honeymoon", () => {
    expect(migration).toContain("seven_day_wardrobe");
    expect(migration).toContain("honeymoon_phase");
  });
});
