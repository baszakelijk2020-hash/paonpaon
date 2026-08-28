import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730170000_add_wardrobe_roadmap_outfits_sartorial.sql",
    import.meta.url,
  ),
  "utf8",
);

// Phase C2 — repairs the customer-side wardrobe roadmap approval UPDATE
// (release-integration-lane-h evidence: docs/evidence/runs/
// customer-v3-real-actions-proof/REPORT.md). `enforce_wardrobe_roadmap_
// tenancy()` re-read `retailer_staff_members` on every UPDATE, which a
// customer session cannot see under RLS, so every legitimate customer
// approve/reject failed. The fix runs that lookup only on INSERT.
const tenancyFix = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260828155029_fix_wardrobe_roadmap_tenancy_update_author_recheck.sql",
    import.meta.url,
  ),
  "utf8",
);

// The migration's own explanatory `--` comments legitimately discuss
// "security definer" (as the shortcut this fix deliberately does NOT take),
// "grant", and "retailer_staff_members" in prose. Strip line comments
// before asserting on what the executable SQL actually does, so those
// checks test the real trigger body/DDL, not the prose describing it.
const tenancyFixCode = tenancyFix
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

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

describe("wardrobe roadmap tenancy-trigger UPDATE fix (phase C2)", () => {
  it("keeps the function explicit security invoker, never security definer", () => {
    expect(tenancyFixCode).toContain(
      "create or replace function public.enforce_wardrobe_roadmap_tenancy()",
    );
    expect(tenancyFixCode).toContain("security invoker");
    expect(tenancyFixCode).not.toContain("security definer");
  });

  it("keeps the empty, schema-qualified search path and revokes public execute", () => {
    expect(tenancyFix).toContain("set search_path = ''");
    expect(tenancyFix).toContain(
      "revoke all on function public.enforce_wardrobe_roadmap_tenancy() from public",
    );
  });

  it("still resolves the author through an active retailer_staff_members row on INSERT", () => {
    expect(tenancyFixCode).toMatch(/if\s+tg_op\s*=\s*'INSERT'\s+then/i);
    expect(tenancyFixCode).toContain(
      "from public.retailer_staff_members as staff",
    );
    expect(tenancyFixCode).toContain("staff.id = new.authored_by_staff_id");
    expect(tenancyFixCode).toContain("staff.deleted_at is null");
    expect(tenancyFixCode).toContain(
      "v_staff_retailer_id <> new.retailer_id",
    );
    expect(tenancyFixCode).toContain(
      "Roadmap author does not belong to the retailer",
    );
  });

  it("returns on UPDATE without any retailer_staff_members lookup outside the INSERT branch", () => {
    // Isolate just the function body (between `as $$` and the closing
    // `$$;`) — a trailing `comment on function ... is '...'` legitimately
    // mentions retailer_staff_members in its descriptive string, which is
    // not a lookup and must not count. Within the body, the only
    // reference must be inside the `if tg_op = 'INSERT' then ... end if;`
    // guard — exactly one occurrence, proving UPDATE never reaches that
    // table.
    const bodyMatch = tenancyFixCode.match(/as\s+\$\$([\s\S]*?)\$\$;/);
    expect(bodyMatch).not.toBeNull();
    const functionBody = bodyMatch![1]!;
    const staffLookupOccurrences = (
      functionBody.match(/retailer_staff_members/g) ?? []
    ).length;
    expect(staffLookupOccurrences).toBe(1);
  });

  it("adds no grant on retailer_staff_members to any role", () => {
    expect(tenancyFixCode).not.toMatch(/grant\s+.*retailer_staff_members/i);
  });

  it("does not touch the original migration or the identity-protection trigger", () => {
    // Forward-only: the fix is its own file, never an edit to the original
    // migration that created the table/triggers/policies.
    expect(tenancyFix).not.toContain(
      "create table if not exists public.wardrobe_roadmaps",
    );
    expect(tenancyFix).not.toContain(
      "create or replace function public.protect_wardrobe_roadmap_identity()",
    );
    expect(tenancyFix).not.toContain(
      "create trigger protect_wardrobe_roadmap_identity_on_update",
    );
    // The identity-protection trigger still exists, unmodified, in the
    // original migration this fix builds on.
    expect(migration).toContain(
      "create or replace function public.protect_wardrobe_roadmap_identity()",
    );
    expect(migration).toContain(
      "create trigger protect_wardrobe_roadmap_identity_on_update",
    );
    expect(migration).toContain(
      "Wardrobe roadmap identity fields are immutable",
    );
  });
});
