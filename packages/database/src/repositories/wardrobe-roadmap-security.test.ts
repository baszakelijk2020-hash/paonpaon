import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730170000_add_wardrobe_roadmap_and_outfits.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("wardrobe roadmap and outfit database security contract", () => {
  it("enables RLS and removes anonymous Data API access", () => {
    expect(migration).toContain(
      "alter table public.wardrobe_roadmaps enable row level security",
    );
    expect(migration).toContain(
      "alter table public.outfits enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.wardrobe_roadmaps from anon/,
    );
    expect(migration).toMatch(/revoke all on table public\.outfits from anon/);
  });

  it("scopes customer reads to approved roadmaps and outfits", () => {
    expect(migration).toContain(
      'create policy "customers read approved wardrobe roadmaps"',
    );
    expect(migration).toContain(
      'create policy "customers read approved outfits"',
    );
    expect(migration).toContain("status = 'approved'");
    expect(migration).toContain("c.user_id = (select auth.uid())");
  });

  it("scopes advisor authoring to tenant staff roles", () => {
    expect(migration).toContain(
      'create policy "retailer staff insert tenant wardrobe roadmaps"',
    );
    expect(migration).toContain(
      'create policy "retailer staff insert tenant outfits"',
    );
    expect(migration).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
    expect(migration).toContain(
      "(select public.current_retailer_role()) in (\n      'sales_associate', 'manager', 'admin', 'owner'\n    )",
    );
  });

  it("enforces cross-tenant reference denial for gaps and outfit slots", () => {
    expect(migration).toContain(
      "Roadmap gap product does not belong to the retailer",
    );
    expect(migration).toContain(
      "Outfit slot wardrobe item does not belong to the relationship",
    );
    expect(migration).toContain(
      "create trigger enforce_wardrobe_gaps_reference_tenancy",
    );
    expect(migration).toContain(
      "create trigger enforce_outfit_slots_reference_tenancy",
    );
  });
});
