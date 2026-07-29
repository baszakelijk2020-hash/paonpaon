import { describe, expect, it } from "vitest";

import {
  DEFAULT_IMPORT_ENRICHMENT_PROMPT_MARKDOWN,
  IMPORT_ENRICHMENT_PROTECTED_FIELDS,
  importEnrichmentIdempotencyKey,
  validateImportEnrichmentOutput,
} from "./import-enrichment";
import {
  importEnrichmentModelOutputSchema,
  updateImportEnrichmentPromptInputSchema,
} from "./import-enrichment.schema";

const row = {
  externalSku: "LP-SUM-001",
  name: "Summer hopsack jacket",
  description:
    "Lightweight hopsack for warm-weather tailored looks. Breathable tropical weave.",
  supplierFacts: {
    mill: "Loro Piana",
    composition: "100% wool",
    weight_gsm: "230",
    construction: "",
    weave: "",
  },
};

const knownTaxonomy = [
  { kind: "weave", slug: "hopsack", canonicalName: "Hopsack" },
  { kind: "climate", slug: "warm", canonicalName: "Warm" },
];

describe("import enrichment prompt contract", () => {
  it("ships a golden external prompt covering protected facts and JSON schema", () => {
    expect(DEFAULT_IMPORT_ENRICHMENT_PROMPT_MARKDOWN).toContain(
      "Do not invent",
    );
    for (const field of ["mill", "composition", "weight_gsm", "construction"]) {
      expect(DEFAULT_IMPORT_ENRICHMENT_PROMPT_MARKDOWN).toContain(field);
    }
    expect(DEFAULT_IMPORT_ENRICHMENT_PROMPT_MARKDOWN).toContain('"proposals"');
    expect(IMPORT_ENRICHMENT_PROTECTED_FIELDS).toContain("mill");
  });

  it("validates Admin prompt updates", () => {
    const parsed = updateImportEnrichmentPromptInputSchema.safeParse({
      title: "Catalogue import enrichment",
      promptMarkdown: DEFAULT_IMPORT_ENRICHMENT_PROMPT_MARKDOWN,
      active: true,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("validateImportEnrichmentOutput", () => {
  it("accepts schema-valid taxonomy and suitability proposals with evidence", () => {
    const raw = {
      proposals: [
        {
          field: "weave",
          proposedValue: "hopsack",
          mappedConceptSlug: "hopsack",
          confidence: 0.92,
          evidence: "Description says Lightweight hopsack",
        },
        {
          field: "climate",
          proposedValue: "warm",
          mappedConceptSlug: "warm",
          confidence: 0.8,
          evidence: "warm-weather tailored looks",
        },
      ],
    };
    expect(importEnrichmentModelOutputSchema.safeParse(raw).success).toBe(true);

    const result = validateImportEnrichmentOutput({
      raw,
      row,
      knownTaxonomy,
    });
    expect(result.ok).toBe(true);
    expect(result.proposals).toHaveLength(2);
    expect(result.proposals[0]).toMatchObject({
      field: "weave",
      source: "ai",
      mappedConceptSlug: "hopsack",
    });
  });

  it("rejects malicious or invalid model output", () => {
    expect(
      validateImportEnrichmentOutput({
        raw: "DROP TABLE",
        row,
        knownTaxonomy,
      }).ok,
    ).toBe(false);

    expect(
      validateImportEnrichmentOutput({
        raw: { proposals: [{ field: "weave" }] },
        row,
        knownTaxonomy,
      }).proposals,
    ).toHaveLength(0);

    expect(
      validateImportEnrichmentOutput({
        raw: {
          proposals: [
            {
              field: "weave",
              proposedValue: "hopsack",
              confidence: 0.9,
              evidence: "",
            },
          ],
        },
        row,
        knownTaxonomy,
      }).rejections.some((item) => item.code === "missing_evidence"),
    ).toBe(true);
  });

  it("keeps unknown taxonomy reviewable without mappedConceptSlug", () => {
    const result = validateImportEnrichmentOutput({
      raw: {
        proposals: [
          {
            field: "pattern",
            proposedValue: "melange-rust",
            mappedConceptSlug: "not-a-real-slug",
            confidence: 0.7,
            evidence: "Rust Pink Melange in the description",
          },
        ],
      },
      row,
      knownTaxonomy,
    });
    expect(result.ok).toBe(true);
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.mappedConceptSlug).toBeUndefined();
    expect(
      result.rejections.some((item) => item.code === "unknown_taxonomy_slug"),
    ).toBe(true);
  });

  it("rejects invented mill and composition", () => {
    const result = validateImportEnrichmentOutput({
      raw: {
        proposals: [
          {
            field: "mill",
            proposedValue: "Invented Mill Co",
            confidence: 0.99,
            evidence: "I guessed the mill",
          },
          {
            field: "composition",
            proposedValue: "80% cashmere 20% silk",
            confidence: 0.99,
            evidence: "made up",
          },
          {
            field: "construction",
            proposedValue: "full-canvas",
            confidence: 0.9,
            evidence: "invented because supplier left construction empty",
          },
        ],
      },
      row,
      knownTaxonomy,
    });
    expect(result.proposals).toHaveLength(0);
    expect(
      result.rejections.filter(
        (item) => item.code === "invented_protected_fact",
      ),
    ).toHaveLength(3);
  });

  it("builds stable idempotency keys for retries", () => {
    expect(
      importEnrichmentIdempotencyKey({
        importRowId: "44444444-4444-4444-8444-444444444444",
        promptVersion: "v1",
      }),
    ).toBe("import-enrichment:44444444-4444-4444-8444-444444444444:v1:default");
  });
});
