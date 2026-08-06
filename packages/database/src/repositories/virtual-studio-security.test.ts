import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260806100000_add_virtual_wardrobe_studio_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("virtual wardrobe studio database security contract", () => {
  it("enables RLS and removes anonymous Data API access on every new table", () => {
    for (const table of [
      "style_portraits",
      "style_portrait_references",
      "retailer_visual_presets",
      "wardrobe_visualization_jobs",
      "wardrobe_visualization_feedback",
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

  it("scopes style portraits to the owning customer and their retailer's staff", () => {
    expect(migration).toContain(
      'create policy "customers read own style portraits"',
    );
    expect(migration).toContain(
      'create policy "retailer staff read tenant style portraits"',
    );
    expect(migration).toContain("c.user_id = (select auth.uid())");
    expect(migration).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
  });

  it("never revives a customer-level manufacturing fit profile", () => {
    // ADR-074: the fit archetype is a MetadataConcept, not a new table.
    expect(migration).not.toContain(
      "create table if not exists public.fit_profiles",
    );
    expect(migration).not.toContain(
      "create table if not exists public.customer_fit_profiles",
    );
    expect(migration).toContain(
      "kind, slug, canonical_name, attributes, active",
    );
    expect(migration).toContain("'fit'");
    expect(migration).toContain("fit-archetype-slim");
  });

  it("makes body-modification prohibition non-configurable on presets", () => {
    expect(migration).toContain(
      "body_modification_prohibited boolean not null default true",
    );
    expect(migration).toContain("check (body_modification_prohibited = true)");
  });

  it("requires exactly one outfit author (staff xor customer)", () => {
    expect(migration).toContain(
      "(created_by_staff_id is not null) <> (created_by_customer_id is not null)",
    );
    expect(migration).toContain('create policy "customers insert own outfits"');
  });

  it("enforces cross-tenant denial for visualization job references", () => {
    expect(migration).toContain(
      "Visualization job outfit does not match the relationship",
    );
    expect(migration).toContain(
      "Visualization job style portrait does not match the relationship",
    );
    expect(migration).toContain(
      "Visualization job preset does not belong to the retailer",
    );
    expect(migration).toContain("Feedback job does not match the relationship");
  });

  it("blocks duplicate active generation jobs for the same outfit/input", () => {
    expect(migration).toContain(
      "wardrobe_visualization_jobs_active_input_uidx",
    );
    expect(migration).toContain("where status in ('queued', 'generating')");
  });

  it("allows cancellation only while a job is still queued", () => {
    expect(migration).toContain("Only a queued job can be cancelled");
  });

  it("restricts the queue claim/complete RPCs to service_role", () => {
    expect(migration).toContain(
      "grant execute on function public.claim_pending_wardrobe_visualization_jobs(integer)\n  to service_role;",
    );
    expect(migration).toContain(
      "grant execute on function public.complete_wardrobe_visualization_job(\n  uuid, text, text, text, integer\n) to service_role;",
    );
  });

  it("scopes wardrobe-studio storage objects to the owning customer or their retailer's staff", () => {
    expect(migration).toContain("can_access_wardrobe_studio_object");
    expect(migration).toContain("bucket_id = 'wardrobe-studio'");
    expect(migration).toContain(
      "public.current_retailer_role() in (\n      'sales_associate', 'manager', 'admin', 'owner'\n    );",
    );
  });
});
