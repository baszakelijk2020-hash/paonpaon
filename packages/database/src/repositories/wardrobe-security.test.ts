import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260731100000_create_wardrobe_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("wardrobe database security contract", () => {
  it("enables RLS and removes anonymous Data API access", () => {
    expect(migration).toContain(
      "alter table public.wardrobe_items enable row level security",
    );
    expect(migration).toContain(
      "alter table public.wardrobe_ownership_events enable row level security",
    );
    expect(migration).toMatch(/revoke all on table public\.wardrobe_items from anon/);
    expect(migration).toMatch(
      /revoke all on table public\.wardrobe_ownership_events from anon/,
    );
    expect(migration).not.toContain("auth.user_metadata");
  });

  it("keeps wardrobe writes behind RPCs for authenticated clients", () => {
    expect(migration).toContain("grant select on table public.wardrobe_items");
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all)[^;]*wardrobe_items[^;]*authenticated/i,
    );
    expect(migration).toContain(
      "create or replace function public.create_external_wardrobe_item",
    );
    expect(migration).toContain(
      "create or replace function public.create_retailer_purchase_wardrobe_item",
    );
    expect(migration).toContain(
      "create or replace function public.update_wardrobe_item_state",
    );
    expect(migration).toContain(
      "create or replace function public.add_wardrobe_advisor_note",
    );
    expect(migration).toContain(
      "create or replace function public.archive_wardrobe_item",
    );
  });

  it("separates external items from catalogue links", () => {
    expect(migration).toContain("wardrobe_items_external_no_catalogue_link");
    expect(migration).toContain("ownership_source <> 'external'");
    expect(migration).toContain("wardrobe_items_retailer_purchase_has_link");
  });

  it("records append-only ownership history", () => {
    expect(migration).toContain("wardrobe_ownership_events");
    expect(migration).toContain("event_type");
    expect(migration).toContain("'advisor_note'");
    expect(migration).not.toMatch(
      /create trigger.*wardrobe_ownership_events.*updated_at/i,
    );
  });

  it("scopes advisor reads to the same retailer relationship", () => {
    expect(migration).toContain(
      'create policy "retailer staff read tenant wardrobe items"',
    );
    expect(migration).toContain(
      'create policy "customers read own wardrobe items"',
    );
    expect(migration).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
  });

  it("enables wardrobe_item metadata targets after Stage 4.1", () => {
    expect(migration).toContain("when 'wardrobe_item' then");
    expect(migration).toContain("from public.wardrobe_items as item");
    expect(migration).not.toContain(
      "Wardrobe metadata targets are not available before Stage 4.1",
    );
  });
});
