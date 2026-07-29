import { CATALOGUE_IMPORT_ENRICHMENT_JSON_EXAMPLE } from "@paon/domain";
import { describe, expect, it } from "vitest";

import { runCatalogueImportEnrichment } from "./import-enrichment-runner";
import { MockAIProvider } from "./mock-provider";

const supplierRow = {
  external_sku: "LP-SUM-001",
  name: "Summer hopsack jacket",
  garment_type: "jacket",
  mill: "Loro Piana",
  weave: "hopsack",
};

const taxonomy = {
  isKnownConcept: (kind: string, slug: string) =>
    kind === "garment_type" && slug === "jacket",
  findConceptId: () => null,
};

describe("runCatalogueImportEnrichment", () => {
  it("returns a validated proposal from a mock provider", async () => {
    const provider = new MockAIProvider().setEnrichment({
      proposal: CATALOGUE_IMPORT_ENRICHMENT_JSON_EXAMPLE,
    });

    const result = await runCatalogueImportEnrichment({
      provider,
      context: {
        contractMarkdown: "contract",
        supplierRow,
        proposedProductSummary: "Summer hopsack jacket",
        taxonomy: [{ kind: "garment_type", slug: "jacket", label: "Jacket" }],
      },
      supplierRow,
      taxonomy,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.proposal.taxonomyMappings.length).toBeGreaterThan(0);
      expect(result.provider).toBe("mock");
    }
  });

  it("fails closed on malicious provider output", async () => {
    const provider = new MockAIProvider().setEnrichment({
      proposal: {
        taxonomyMappings: [
          {
            field: "mill",
            conceptSlug: "fake_mill",
            confidence: 0.99,
            source: "inferred",
            evidence: "Looks fancy.",
          },
        ],
        derivedSuitability: [],
      },
    });

    const result = await runCatalogueImportEnrichment({
      provider,
      context: {
        contractMarkdown: "contract",
        supplierRow,
        proposedProductSummary: "Summer hopsack jacket",
        taxonomy: [],
      },
      supplierRow,
      taxonomy,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
  });

  it("surfaces provider errors for retry/idempotency callers", async () => {
    const provider = new MockAIProvider().setEnrichmentError(
      new Error("rate limited"),
    );

    const result = await runCatalogueImportEnrichment({
      provider,
      context: {
        contractMarkdown: "contract",
        supplierRow,
        proposedProductSummary: "Summer hopsack jacket",
        taxonomy: [],
      },
      supplierRow,
      taxonomy,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider_error");
      expect(result.error).toContain("rate limited");
    }
  });
});
