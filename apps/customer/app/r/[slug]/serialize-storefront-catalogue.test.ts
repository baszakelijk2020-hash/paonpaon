import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const templatePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "paon-template.html",
);

const AUTHORIZED_CATALOGUE_MARKERS = [
  "__PAON_CATALOGUE_JSON__",
  "PAON_CATALOGUE",
  "paon-catalogue-intent-note",
  "paonMountCatalogueIntentNote",
] as const;

describe("founder storefront catalogue query DOM allowlist", () => {
  it("only introduces authorized catalogue-search mount markers", () => {
    const template = readFileSync(templatePath, "utf8");
    const catalogueMentions = [
      ...template.matchAll(/paon-catalogue[\w-]*/gi),
      ...template.matchAll(/PAON_CATALOGUE[\w_]*/g),
      ...template.matchAll(/__PAON_CATALOGUE_[A-Z0-9_]+__/g),
      ...template.matchAll(/paonMountCatalogue[A-Za-z]*/g),
    ].map((match) => match[0]);

    for (const mention of catalogueMentions) {
      const allowed = AUTHORIZED_CATALOGUE_MARKERS.some(
        (marker) => mention === marker || mention.startsWith("paon-catalogue-"),
      );
      expect(allowed, `unauthorized marker: ${mention}`).toBe(true);
    }

    expect(template).toContain("__PAON_CATALOGUE_JSON__");
    expect(template).toContain("paonMountCatalogueIntentNote");
  });
});

describe("serializeStorefrontCatalogueJson", () => {
  it("serializes intent transparency for unresolved search language", async () => {
    const { serializeStorefrontCatalogueJson } = await import(
      "./serialize-storefront-catalogue"
    );

    const json = serializeStorefrontCatalogueJson({
      searchQuery: "unknown phrase",
      intent: {
        status: "unresolved",
        query: "unknown phrase",
        matchedConceptIds: [],
        explanation: "No approved intent mapping matched this language.",
        fallbackReason:
          "Falling back to product name and description keyword matching only.",
      },
      facets: [],
    });

    expect(JSON.parse(json)).toEqual({
      searchQuery: "unknown phrase",
      intent: expect.objectContaining({ status: "unresolved" }),
      facets: [],
    });
  });
});
