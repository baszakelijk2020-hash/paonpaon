import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730170000_add_wardrobe_roadmap_outfits_sartorial.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("wardrobe roadmap / sartorial database security contract", () => {
  it("enables RLS and removes anonymous Data API access", () => {
    for (const table of [
      "sartorial_rules",
      "wardrobe_roadmaps",
      "wardrobe_roadmap_goals",
      "wardrobe_roadmap_gaps",
      "wardrobe_roadmap_stages",
      "outfits",
      "outfit_slots",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(`revoke all on table public\\.${table} from anon`),
      );
    }
    expect(migration).not.toContain("auth.user_metadata");
  });

  it("scopes roadmaps and outfits to the retailer-customer relationship", () => {
    expect(migration).toContain(
      'create policy "customers read visible wardrobe roadmaps"',
    );
    expect(migration).toContain(
      'create policy "retailer staff read tenant wardrobe roadmaps"',
    );
    expect(migration).toContain(
      'create policy "customers update pending wardrobe roadmaps"',
    );
    expect(migration).toContain('create policy "customers read own outfits"');
    expect(migration).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
    expect(migration).toContain("c.user_id = (select auth.uid())");
    expect(migration).toContain(
      "Roadmap author does not belong to the retailer",
    );
    expect(migration).toContain(
      "Outfit roadmap does not belong to the relationship",
    );
  });

  it("requires stage suggestions to cite rules and facts", () => {
    expect(migration).toContain("wardrobe_roadmap_stages_citations_chk");
    expect(migration).toContain("jsonb_array_length(rule_citations) >= 1");
    expect(migration).toContain("jsonb_array_length(fact_citations) >= 1");
  });

  it("seeds accepted canonical sartorial slot rules and extends wardrobe categories", () => {
    expect(migration).toContain("'shoes'");
    expect(migration).toContain("'pocket_square'");
    expect(migration).toContain("jacket-trousers-foundation");
    expect(migration).toContain("review_status");
    expect(migration).toContain("'accepted'");
    expect(migration).toContain(
      'create policy "retailer managers review tenant sartorial rules"',
    );
  });

  it("enforces cross-tenant denial for roadmap and outfit references", () => {
    expect(migration).toContain(
      "Roadmap product does not belong to the retailer",
    );
    expect(migration).toContain(
      "Outfit product does not belong to the retailer",
    );
    expect(migration).toContain(
      "Outfit wardrobe item does not belong to the retailer",
    );
  });
});
