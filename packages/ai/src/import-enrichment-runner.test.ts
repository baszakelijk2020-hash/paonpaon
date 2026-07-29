import { describe, expect, it, vi } from "vitest";

import {
  MockImportEnrichmentProvider,
  runImportEnrichmentJob,
} from "./import-enrichment-runner";
import { OpenAIProvider } from "./openai-provider";

function fakeOpenAI(content: string | null) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  });
  return { client: { chat: { completions: { create } } } as never, create };
}

const enrichmentContext = {
  systemPrompt: "Return JSON proposals only.",
  row: {
    externalSku: "LP-SUM-001",
    name: "Summer hopsack jacket",
    description: "Lightweight hopsack",
    supplierFacts: { mill: "Loro Piana", composition: "100% wool" },
  },
  knownTaxonomy: [{ kind: "weave", slug: "hopsack", canonicalName: "Hopsack" }],
};

describe("OpenAIProvider import enrichment", () => {
  it("sends the Admin system prompt and returns parsed JSON", async () => {
    const payload = {
      proposals: [
        {
          field: "weave",
          proposedValue: "hopsack",
          confidence: 0.9,
          evidence: "Lightweight hopsack",
        },
      ],
    };
    const { client, create } = fakeOpenAI(JSON.stringify(payload));
    const provider = new OpenAIProvider(client);

    const result = await provider.enrichCatalogueImportRow(enrichmentContext);

    expect(result).toEqual(payload);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: "json_object" },
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: "Return JSON proposals only.",
          }),
        ]),
      }),
    );
  });

  it("throws on invalid enrichment JSON", async () => {
    const { client } = fakeOpenAI("not-json");
    const provider = new OpenAIProvider(client);
    await expect(
      provider.enrichCatalogueImportRow(enrichmentContext),
    ).rejects.toThrow("not valid JSON");
  });
});

describe("runImportEnrichmentJob", () => {
  it("returns success from a mock provider", async () => {
    const output = {
      proposals: [
        {
          field: "weave",
          proposedValue: "hopsack",
          confidence: 0.9,
          evidence: "hopsack",
        },
      ],
    };
    const provider = new MockImportEnrichmentProvider(output);
    const result = await runImportEnrichmentJob(provider, {
      idempotencyKey: "import-enrichment:row:v1:default",
      ...enrichmentContext,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rawOutput).toEqual(output);
      expect(result.attempts).toBe(1);
      expect(result.provider).toBe("mock");
    }
  });

  it("retries transient failures then reports failure", async () => {
    const provider = new MockImportEnrichmentProvider({}, "transient");
    const enrich = vi.spyOn(provider, "enrichCatalogueImportRow");
    const result = await runImportEnrichmentJob(
      provider,
      {
        idempotencyKey: "import-enrichment:row:v1:default",
        ...enrichmentContext,
      },
      { maxAttempts: 2 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempts).toBe(2);
      expect(result.errorMessage).toContain("transient");
    }
    expect(enrich).toHaveBeenCalledTimes(2);
  });
});
