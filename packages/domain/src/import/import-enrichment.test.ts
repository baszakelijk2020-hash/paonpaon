import { describe, expect, it } from "vitest";

import { CATALOGUE_IMPORT_TEMPLATE_EXAMPLE_ROW } from "./import-contract";
import {
  CATALOGUE_IMPORT_ENRICHMENT_JSON_EXAMPLE,
  mergeEnrichmentIntoProposedProduct,
  validateEnrichmentProposal,
} from "./import-enrichment";

const supplierRow = CATALOGUE_IMPORT_TEMPLATE_EXAMPLE_ROW;

const taxonomy = {
  isKnownConcept: (kind: string, slug: string) =>
    (kind === "garment_type" && slug === "jacket") ||
    (kind === "mill" && (slug === "loro_piana" || slug === "loro-piana")) ||
    (kind === "climate" && slug === "warm"),
  findConceptId: (kind: string, slug: string) => {
    if (kind === "garment_type" && slug === "jacket") {
      return "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as never;
    }
    if (kind === "mill" && (slug === "loro_piana" || slug === "loro-piana")) {
      return "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as never;
    }
    if (kind === "climate" && slug === "warm") {
      return "cccccccc-cccc-4ccc-8ccc-cccccccccccc" as never;
    }
    return null;
  },
};

describe("validateEnrichmentProposal", () => {
  it("accepts a golden enrichment fixture", () => {
    const result = validateEnrichmentProposal({
      raw: CATALOGUE_IMPORT_ENRICHMENT_JSON_EXAMPLE,
      supplierRow,
      taxonomy,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.proposal.taxonomyMappings).toHaveLength(2);
    }
  });

  it("rejects invalid JSON shapes", () => {
    const result = validateEnrichmentProposal({
      raw: { taxonomyMappings: "nope" },
      supplierRow,
      taxonomy,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe("invalid_schema");
    }
  });

  it("rejects invented mill mappings", () => {
    const result = validateEnrichmentProposal({
      raw: {
        taxonomyMappings: [
          {
            field: "mill",
            conceptSlug: "fake_mill",
            confidence: 0.99,
            source: "inferred",
            evidence: "Looks premium.",
          },
        ],
        derivedSuitability: [],
      },
      supplierRow,
      taxonomy,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some((i) => i.code === "invalid_supplier_source"),
      ).toBe(true);
    }
  });

  it("rejects invalid schema for protected composition fields", () => {
    const result = validateEnrichmentProposal({
      raw: {
        taxonomyMappings: [],
        derivedSuitability: [
          {
            field: "composition",
            value: "100% cotton",
            confidence: 0.5,
            source: "inferred",
            evidence: "Guess.",
          },
        ],
      },
      supplierRow,
      taxonomy,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe("invalid_schema");
    }
  });

  it("allows unknown taxonomy with informational issues only", () => {
    const result = validateEnrichmentProposal({
      raw: {
        taxonomyMappings: [
          {
            field: "weave",
            conceptSlug: "mystery_weave",
            confidence: 0.7,
            source: "supplier_text",
            evidence: 'Supplier weave column says "hopsack".',
          },
        ],
        derivedSuitability: [],
      },
      supplierRow,
      taxonomy,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects malicious model output that overrides supplier garment_type", () => {
    const result = validateEnrichmentProposal({
      raw: {
        taxonomyMappings: [],
        derivedSuitability: [
          {
            field: "garment_type",
            value: "trousers",
            confidence: 0.99,
            source: "inferred",
            evidence: "Hallucinated garment change.",
          },
        ],
      },
      supplierRow,
      taxonomy,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe("invented_protected_fact");
    }
  });
});

describe("mergeEnrichmentIntoProposedProduct", () => {
  it("merges validated proposals into pending review tasks", () => {
    const base = {
      externalSku: supplierRow.external_sku,
      name: supplierRow.name,
      assetMatches: [],
      categoryMappings: [],
    };
    const validated = validateEnrichmentProposal({
      raw: CATALOGUE_IMPORT_ENRICHMENT_JSON_EXAMPLE,
      supplierRow,
      taxonomy,
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const merged = mergeEnrichmentIntoProposedProduct({
      proposedProduct: base,
      proposal: validated.proposal,
      supplierRow,
      taxonomy,
    });

    expect(merged.reviewTasks).toHaveLength(3);
    expect(merged.proposedProduct.categoryMappings.length).toBeGreaterThan(0);
    expect(
      merged.proposedProduct.categoryMappings.every(
        (mapping) => mapping.status !== "mapped" || mapping.mappedConceptId,
      ),
    ).toBe(true);
    expect(merged.proposedProduct.climate).toBe("warm");
  });

  it("is idempotent when merging the same proposal twice", () => {
    const base = {
      externalSku: supplierRow.external_sku,
      name: supplierRow.name,
      assetMatches: [],
      categoryMappings: [],
    };
    const validated = validateEnrichmentProposal({
      raw: CATALOGUE_IMPORT_ENRICHMENT_JSON_EXAMPLE,
      supplierRow,
      taxonomy,
    });
    if (!validated.ok) throw new Error("fixture must validate");

    const first = mergeEnrichmentIntoProposedProduct({
      proposedProduct: base,
      proposal: validated.proposal,
      supplierRow,
      taxonomy,
    });
    const second = mergeEnrichmentIntoProposedProduct({
      proposedProduct: first.proposedProduct,
      proposal: validated.proposal,
      supplierRow,
      taxonomy,
    });

    expect(second.reviewTasks).toHaveLength(first.reviewTasks.length);
  });
});
