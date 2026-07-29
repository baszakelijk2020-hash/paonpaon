import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const foundationMigration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730010000_create_knowledge_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);
const fixtureMigration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730010001_seed_canonical_knowledge_fixtures.sql",
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
      expect(foundationMigration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(foundationMigration).toMatch(
        new RegExp(
          `revoke all on table[\\s\\S]*public\\.${table}[\\s\\S]*from anon`,
        ),
      );
    }
  });

  it("keeps canonical copy immutable for retailers and allows local overrides", () => {
    expect(foundationMigration).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
    expect(foundationMigration).toContain(
      "retailer_id is null or retailer_id = (select public.current_retailer_id())",
    );
    expect(foundationMigration).toContain(
      "(select public.is_platform_staff())",
    );
    expect(foundationMigration).toContain(
      "Canonical knowledge may join canonical concepts only",
    );
    expect(foundationMigration).toContain(
      "Knowledge relation crosses retailer boundaries",
    );
    expect(foundationMigration).toContain(
      "Knowledge override object does not belong to the retailer",
    );
    expect(foundationMigration).toContain(
      "is_pinned boolean not null default false",
    );
    expect(foundationMigration).toContain(
      "is_hidden boolean not null default false",
    );
  });

  it("seeds every founder education topic with stable fixture ids", () => {
    for (const topic of [
      "mill",
      "fibre",
      "fabric",
      "weave",
      "construction",
      "collar",
      "styling",
      "care",
      "performance",
      "occasion",
      "value",
      "tradeoff",
    ]) {
      expect(fixtureMigration).toContain(`'${topic}'`);
    }
    expect(fixtureMigration).toContain("on conflict (id) do update");
    expect(fixtureMigration).toContain("unapproved-mill-editorial-placeholder");
    expect(fixtureMigration).toContain("false");
  });
});
