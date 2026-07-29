import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730120000_create_knowledge_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

const knowledgeTables = [
  "knowledge_objects",
  "knowledge_object_concepts",
  "knowledge_object_relations",
  "retailer_knowledge_overrides",
];

describe("knowledge database security contract", () => {
  it("enables RLS and removes anonymous Data API access on every table", () => {
    for (const table of knowledgeTables) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(
          `revoke all on table[\\s\\S]*public\\.${table}[\\s\\S]*from anon`,
        ),
      );
    }
  });

  it("limits tenant management to manager roles while preserving platform authority", () => {
    expect(migration).toContain(
      "(select public.current_retailer_role()) in ('manager', 'admin', 'owner')",
    );
    expect(migration).toContain("(select public.is_platform_staff())");
    expect(migration).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
    expect(migration).toContain(
      "retailer_id is null or retailer_id = (select public.current_retailer_id())",
    );
  });

  it("enforces cross-tenant references below the repository layer", () => {
    expect(migration).toContain(
      "Canonical knowledge may link canonical concepts only",
    );
    expect(migration).toContain(
      "Knowledge concept does not belong to the retailer",
    );
    expect(migration).toContain(
      "Canonical relations may reference canonical knowledge only",
    );
    expect(migration).toContain(
      "Knowledge override object does not belong to the retailer",
    );
  });

  it("models local hide, pin, and presentation overrides without forking canonical copy", () => {
    expect(migration).toContain("is_hidden boolean not null default false");
    expect(migration).toContain("is_pinned boolean not null default false");
    expect(migration).toContain("title_override text");
    expect(migration).toContain("summary_override text");
    expect(migration).toContain("priority_override integer");
  });
});
