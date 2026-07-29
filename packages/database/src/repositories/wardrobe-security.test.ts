import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730160000_add_wardrobe_ownership.sql",
    import.meta.url,
  ),
  "utf8",
);

const metadataFoundation = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260729174939_create_metadata_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("wardrobe ownership database security contract", () => {
  it("enables RLS and removes anonymous Data API access", () => {
    expect(migration).toContain(
      "alter table public.wardrobe_items enable row level security",
    );
    expect(migration).toContain(
      "alter table public.wardrobe_ownership_events enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.wardrobe_items from anon/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.wardrobe_ownership_events from anon/,
    );
    expect(migration).not.toContain("auth.user_metadata");
  });

  it("scopes customer and advisor collaboration to the same retailer relationship", () => {
    expect(migration).toContain(
      'create policy "customers read own wardrobe items"',
    );
    expect(migration).toContain(
      'create policy "retailer staff read tenant wardrobe items"',
    );
    expect(migration).toContain(
      'create policy "customers insert own wardrobe items"',
    );
    expect(migration).toContain(
      'create policy "retailer staff insert tenant wardrobe items"',
    );
    expect(migration).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
    expect(migration).toContain("c.user_id = (select auth.uid())");
    expect(migration).toContain(
      "(select public.current_retailer_role()) in (\n      'sales_associate', 'manager', 'admin', 'owner'\n    )",
    );
  });

  it("keeps ownership history append-only for authenticated clients", () => {
    expect(migration).toContain(
      "grant select on table public.wardrobe_ownership_events",
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all)[^;]*wardrobe_ownership_events[^;]*authenticated/i,
    );
    expect(migration).toContain(
      "create or replace function public.record_wardrobe_ownership_event",
    );
    expect(migration).toContain("event_kind");
    expect(migration).toContain("'acquired'");
    expect(migration).toContain("'retired'");
  });

  it("enforces ownership, provenance, and cross-tenant reference denial", () => {
    expect(migration).toContain("wardrobe_items_ownership_provenance_chk");
    expect(migration).toContain("and order_line_id is null");
    expect(migration).toContain(
      "Wardrobe product does not belong to the retailer",
    );
    expect(migration).toContain(
      "Wardrobe order line does not belong to the retailer",
    );
    expect(migration).toContain(
      "Wardrobe physical garment does not belong to the relationship",
    );
    expect(migration).toContain("Wardrobe item identity fields are immutable");
  });

  it("enables wardrobe_item metadata targets for external review", () => {
    expect(metadataFoundation).toContain(
      "raise exception 'Wardrobe metadata targets are not available before Stage 4.1'",
    );
    expect(migration).toContain("when 'wardrobe_item' then");
    expect(migration).toContain("from public.wardrobe_items as item");
    expect(migration).not.toContain(
      "Wardrobe metadata targets are not available before Stage 4.1",
    );
  });
});
