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
    expect(tenancyFixCode).toContain("v_staff_retailer_id <> new.retailer_id");
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

// Phase 20.17 — customer removal of an advisor selection from the wardrobe
// plan. New forward-only migration adds a customer-scoped, one-way
// `wardrobe_roadmap_gap_dispositions` table. It must isolate the
// disposition per customer/tenant without a SECURITY DEFINER shortcut,
// without granting customers anything on unrelated tables, and without
// touching the advisor-authored roadmap/gap/stage rows.
const gapDisposition = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260828185506_add_wardrobe_roadmap_gap_dispositions.sql",
    import.meta.url,
  ),
  "utf8",
);

const gapDispositionCode = gapDisposition
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

describe("wardrobe roadmap gap-disposition migration (phase 20.17)", () => {
  it("is a new forward-only file, not an edit of an existing migration", () => {
    // It creates its own table/triggers/policies; it never recreates or
    // alters objects owned by earlier migrations.
    expect(gapDispositionCode).toContain(
      "create table if not exists public.wardrobe_roadmap_gap_dispositions",
    );
    expect(gapDispositionCode).not.toContain(
      "create table if not exists public.wardrobe_roadmap_gaps",
    );
    expect(gapDispositionCode).not.toContain(
      "create or replace function public.enforce_wardrobe_roadmap_tenancy()",
    );
    expect(gapDispositionCode).not.toMatch(/drop\s+policy/i);
    expect(gapDispositionCode).not.toMatch(
      /alter\s+table\s+public\.wardrobe_roadmaps/i,
    );
    expect(gapDispositionCode).not.toMatch(
      /alter\s+table\s+public\.wardrobe_roadmap_gaps/i,
    );
  });

  it("pins tenancy with a composite customer/retailer foreign key", () => {
    expect(gapDispositionCode).toMatch(
      /foreign key \(customer_id, retailer_id\)\s*references public\.customers \(id, retailer_id\)/,
    );
  });

  it("locks the disposition to a single one-way value", () => {
    expect(gapDispositionCode).toMatch(
      /disposition text not null default 'removed_from_plan'\s*check \(disposition in \('removed_from_plan'\)\)/,
    );
  });

  it("enables RLS and removes anonymous Data API access", () => {
    expect(gapDispositionCode).toContain(
      "alter table public.wardrobe_roadmap_gap_dispositions enable row level security",
    );
    expect(gapDispositionCode).toContain(
      "revoke all on table public.wardrobe_roadmap_gap_dispositions from anon",
    );
  });

  it("keeps both trigger functions explicit security invoker, never security definer", () => {
    for (const fn of [
      "public.enforce_wardrobe_roadmap_gap_disposition_tenancy()",
      "public.protect_wardrobe_roadmap_gap_disposition_identity()",
    ]) {
      expect(gapDispositionCode).toContain(`create or replace function ${fn}`);
    }
    expect(gapDispositionCode).not.toContain("security definer");
    const invokerCount = (gapDispositionCode.match(/security invoker/g) ?? [])
      .length;
    expect(invokerCount).toBe(2);
  });

  it("keeps an empty search path and revokes public execute on both functions", () => {
    const searchPathCount = (
      gapDispositionCode.match(/set search_path = ''/g) ?? []
    ).length;
    expect(searchPathCount).toBe(2);
    expect(gapDispositionCode).toContain(
      "revoke all on function public.enforce_wardrobe_roadmap_gap_disposition_tenancy() from public",
    );
    expect(gapDispositionCode).toContain(
      "revoke all on function public.protect_wardrobe_roadmap_gap_disposition_identity() from public",
    );
  });

  it("re-derives ownership from customer-visible tables only (no retailer_staff_members)", () => {
    const bodyMatches = [
      ...gapDispositionCode.matchAll(/as \$\$([\s\S]*?)\$\$;/g),
    ];
    expect(bodyMatches.length).toBe(2);
    const bodies = bodyMatches.map((m) => m[1]).join("\n");
    expect(bodies).not.toContain("retailer_staff_members");
    expect(bodies).toContain("from public.wardrobe_roadmap_gaps");
    expect(bodies).toContain("from public.wardrobe_roadmaps");
  });

  it("grants customers nothing on retailer_staff_members or other unrelated tables", () => {
    expect(gapDispositionCode).not.toMatch(
      /grant\s+[^;]*retailer_staff_members/i,
    );
    // The only GRANT statements target the new table itself.
    for (const m of gapDispositionCode.matchAll(
      /grant\s+[^;]+?\son\s+(?:table\s+)?([a-z_.]+)/gi,
    )) {
      expect(m[1]).toContain("wardrobe_roadmap_gap_dispositions");
    }
  });

  it("scopes reads/writes to the owning customer and their approved roadmap", () => {
    expect(gapDispositionCode).toContain(
      'create policy "customers read own gap dispositions"',
    );
    expect(gapDispositionCode).toContain(
      'create policy "customers create own gap dispositions"',
    );
    expect(gapDispositionCode).toContain(
      'create policy "retailer staff read tenant gap dispositions"',
    );
    expect(gapDispositionCode).toContain("c.user_id = (select auth.uid())");
    expect(gapDispositionCode).toContain("r.status = 'approved'");
    expect(gapDispositionCode).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
  });

  it("has no update or delete policy for any caller — the disposition is append-only", () => {
    expect(gapDispositionCode).not.toMatch(/create policy[^;]*\sfor update\s/i);
    expect(gapDispositionCode).not.toMatch(/create policy[^;]*\sfor delete\s/i);
  });

  it("keeps the disposition identity columns immutable", () => {
    expect(gapDispositionCode).toContain(
      "create trigger protect_wardrobe_roadmap_gap_disposition_identity_on_update",
    );
    expect(gapDispositionCode).toContain(
      "Wardrobe roadmap gap disposition identity fields are immutable",
    );
  });
});
