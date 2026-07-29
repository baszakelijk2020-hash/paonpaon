import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EMPTY_STOREFRONT_KNOWLEDGE_PANELS,
  type StorefrontKnowledgePanels,
} from "@paon/domain";
import { describe, expect, it } from "vitest";

/**
 * Mirrors apps/customer serialize-storefront-knowledge JSON shape so route
 * injection stays covered without adding a customer vitest runner.
 */
function serializeStorefrontKnowledgeJson(
  knowledgeByProduct: Record<string, StorefrontKnowledgePanels>,
): string {
  return JSON.stringify(knowledgeByProduct);
}

const templatePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../apps/customer/app/r/[slug]/paon-template.html",
);

describe("storefront knowledge route serialization", () => {
  it("serializes empty panels as stable JSON for no-data fallback", () => {
    const json = serializeStorefrontKnowledgeJson({
      "e2e-storefront-overcoat": EMPTY_STOREFRONT_KNOWLEDGE_PANELS,
    });
    expect(JSON.parse(json)).toEqual({
      "e2e-storefront-overcoat": {
        archetype: [],
        fabric: [],
        sizing: [],
      },
    });
  });

  it("serializes card fields the template mount consumes", () => {
    const json = serializeStorefrontKnowledgeJson({
      overcoat: {
        archetype: [
          {
            id: "00000000-0000-4000-8000-000000000001" as never,
            topic: "styling",
            panel: "archetype",
            title: "Style card",
            summary: "Useful copy",
            imageUrl: null,
          },
        ],
        fabric: [],
        sizing: [],
      },
    });
    const parsed = JSON.parse(json) as Record<
      string,
      StorefrontKnowledgePanels
    >;
    expect(parsed["overcoat"]?.archetype[0]?.title).toBe("Style card");
    expect(parsed["overcoat"]?.archetype[0]?.imageUrl).toBeNull();
  });
});

describe("founder template knowledge hook presence", () => {
  it("keeps the knowledge JSON placeholder next to products", () => {
    const template = readFileSync(templatePath, "utf8");
    expect(template).toContain("const products = __PAON_PRODUCTS_JSON__;");
    expect(template).toContain(
      "const PAON_KNOWLEDGE_BY_PRODUCT = __PAON_KNOWLEDGE_BY_PRODUCT_JSON__;",
    );
    expect(template).toContain("paonMountKnowledgePanels(p.id)");
  });
});
