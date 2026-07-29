import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730020000_add_public_storefront_knowledge_reads.sql",
    import.meta.url,
  ),
  "utf8",
);

const templatePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../apps/customer/app/r/[slug]/paon-template.html",
);

/**
 * ENG-004 / EDU-003: only authorized knowledge-mount markers may appear in
 * the founder template. Broader redesign markers fail this allowlist.
 */
const AUTHORIZED_KNOWLEDGE_MARKERS = [
  "__PAON_KNOWLEDGE_BY_PRODUCT_JSON__",
  "PAON_KNOWLEDGE_BY_PRODUCT",
  "PAON_KNOWLEDGE_BY_PRODUCT_JSON__",
  "paon-knowledge-mount",
  "paon-knowledge-archetype",
  "paon-knowledge-fabric",
  "paon-knowledge-sizing",
  "paon-knowledge-cards",
  "paon-knowledge-card",
  "paonMountKnowledgePanels",
] as const;

describe("public storefront knowledge read contract", () => {
  it("grants anon select only on the storefront knowledge subset", () => {
    expect(migration).toContain(
      "grant select on table public.knowledge_objects to anon",
    );
    expect(migration).toContain(
      "grant select on table public.knowledge_object_concepts to anon",
    );
    expect(migration).toContain(
      "grant select on table public.retailer_knowledge_overrides to anon",
    );
    expect(migration).toContain(
      "grant select on table public.entity_metadata_assignments to anon",
    );
    expect(migration).not.toContain(
      "grant select on table public.knowledge_object_relations to anon",
    );
  });

  it("limits public assignment reads to accepted active catalogue rows", () => {
    expect(migration).toContain(
      "anyone can read accepted assignments for active catalogue",
    );
    expect(migration).toContain("review_status = 'accepted'");
    expect(migration).toContain(
      "anyone can read active storefront knowledge objects",
    );
    expect(migration).toContain("active = true");
  });
});

describe("founder storefront knowledge DOM allowlist", () => {
  it("only introduces authorized knowledge-mount markers", () => {
    const template = readFileSync(templatePath, "utf8");
    const knowledgeMentions = [
      ...template.matchAll(/paon-knowledge[\w-]*/gi),
      ...template.matchAll(/PAON_KNOWLEDGE[\w_]*/g),
      ...template.matchAll(/__PAON_KNOWLEDGE_[A-Z0-9_]+__/g),
      ...template.matchAll(/paonMountKnowledge[A-Za-z]*/g),
    ].map((match) => match[0]);

    for (const mention of knowledgeMentions) {
      const allowed = AUTHORIZED_KNOWLEDGE_MARKERS.some(
        (marker) =>
          mention === marker ||
          mention.startsWith("paon-knowledge-card") ||
          mention.startsWith("paon-knowledge-"),
      );
      expect(allowed, `unauthorized marker: ${mention}`).toBe(true);
    }

    expect(template).toContain("__PAON_KNOWLEDGE_BY_PRODUCT_JSON__");
    expect(template).toContain('id="paon-knowledge-archetype"');
    expect(template).toContain('id="paon-knowledge-fabric"');
    expect(template).toContain('id="paon-knowledge-sizing"');
  });
});
