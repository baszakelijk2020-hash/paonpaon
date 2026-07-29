/**
 * Provider-neutral catalogue import enrichment job runner (PHASE 2.7).
 * Validates nothing domain-specific — callers run `@paon/domain`
 * `validateImportEnrichmentOutput` before persisting pending review tasks.
 */

import type { AIProvider } from "./provider";

export interface ImportEnrichmentRowPayload {
  readonly externalSku?: string;
  readonly name?: string;
  readonly description?: string;
  readonly supplierFacts: Readonly<Record<string, string>>;
}

export interface ImportEnrichmentTaxonomyPayload {
  readonly kind: string;
  readonly slug: string;
  readonly canonicalName: string;
}

export interface ImportEnrichmentContext {
  readonly systemPrompt: string;
  readonly row: ImportEnrichmentRowPayload;
  readonly knownTaxonomy: readonly ImportEnrichmentTaxonomyPayload[];
}

export interface ImportEnrichmentJobInput extends ImportEnrichmentContext {
  readonly idempotencyKey: string;
}

export interface ImportEnrichmentJobSuccess {
  readonly ok: true;
  readonly idempotencyKey: string;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly rawOutput: unknown;
}

export interface ImportEnrichmentJobFailure {
  readonly ok: false;
  readonly idempotencyKey: string;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly errorMessage: string;
}

export type ImportEnrichmentJobResult =
  ImportEnrichmentJobSuccess | ImportEnrichmentJobFailure;

export interface ImportEnrichmentRunnerOptions {
  readonly maxAttempts?: number;
}

function buildUserPayload(context: ImportEnrichmentContext): string {
  return JSON.stringify(
    {
      row: context.row,
      knownTaxonomy: context.knownTaxonomy,
      instructions:
        "Return only JSON with a proposals array. Never invent protected supplier facts.",
    },
    null,
    2,
  );
}

/**
 * Runs one enrichment job with bounded retries. Identical idempotency keys
 * are the caller's responsibility when persisting — this runner is itself
 * retry-safe for transient provider failures only.
 */
export async function runImportEnrichmentJob(
  provider: AIProvider,
  input: ImportEnrichmentJobInput,
  options: ImportEnrichmentRunnerOptions = {},
): Promise<ImportEnrichmentJobResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const started = Date.now();
  let attempts = 0;
  let lastError = "Import enrichment failed";

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const rawOutput = await provider.enrichCatalogueImportRow({
        systemPrompt: input.systemPrompt,
        row: input.row,
        knownTaxonomy: input.knownTaxonomy,
      });
      return {
        ok: true,
        idempotencyKey: input.idempotencyKey,
        provider: provider.providerName,
        model: provider.model,
        latencyMs: Date.now() - started,
        attempts,
        rawOutput,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "Import enrichment failed";
    }
  }

  return {
    ok: false,
    idempotencyKey: input.idempotencyKey,
    provider: provider.providerName,
    model: provider.model,
    latencyMs: Date.now() - started,
    attempts,
    errorMessage: lastError,
  };
}

/** Test double — returns a fixed payload without calling a live provider. */
export class MockImportEnrichmentProvider implements AIProvider {
  readonly providerName = "mock";
  readonly model = "mock-enrichment-v1";

  constructor(
    private readonly output: unknown,
    private readonly failureMessage?: string,
  ) {}

  async generateNextBestAction(): Promise<never> {
    throw new Error("MockImportEnrichmentProvider does not support NBA");
  }

  async generateProductRecommendation(): Promise<never> {
    throw new Error(
      "MockImportEnrichmentProvider does not support product recommendation",
    );
  }

  async enrichCatalogueImportRow(
    _context: ImportEnrichmentContext,
  ): Promise<unknown> {
    if (this.failureMessage) {
      throw new Error(this.failureMessage);
    }
    return this.output;
  }

  async generateTableServiceAnswer(): Promise<never> {
    throw new Error(
      "MockImportEnrichmentProvider does not support TableService answers",
    );
  }
}

export { buildUserPayload };
