/**
 * Provider-neutral advisor capture extraction (frictionless note → proposed
 * action bundles). Domain validation of each bundle
 * (`checkCaptureBundleProposal`) and persistence happen outside this
 * package, same split as `import-enrichment-runner.ts`.
 */

import type { AdvisorCaptureContext, AIProvider } from "./provider";

export interface AdvisorCaptureJobOptions {
  readonly maxAttempts?: number;
}

export interface AdvisorCaptureJobSuccess {
  readonly ok: true;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly rawOutput: unknown;
}

export interface AdvisorCaptureJobFailure {
  readonly ok: false;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly errorMessage: string;
}

export type AdvisorCaptureJobResult =
  AdvisorCaptureJobSuccess | AdvisorCaptureJobFailure;

/** Runs one extraction with bounded retries for transient provider failures. */
export async function runAdvisorCaptureJob(
  provider: AIProvider,
  context: AdvisorCaptureContext,
  options: AdvisorCaptureJobOptions = {},
): Promise<AdvisorCaptureJobResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const started = Date.now();
  let attempts = 0;
  let lastError = "Advisor capture extraction failed";

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const rawOutput = await provider.extractAdvisorCaptureBundles(context);
      return {
        ok: true,
        provider: provider.providerName,
        model: provider.model,
        latencyMs: Date.now() - started,
        attempts,
        rawOutput,
      };
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Advisor capture extraction failed";
    }
  }

  return {
    ok: false,
    provider: provider.providerName,
    model: provider.model,
    latencyMs: Date.now() - started,
    attempts,
    errorMessage: lastError,
  };
}

export interface MockAdvisorCaptureProviderOptions {
  readonly output?: unknown;
  readonly failureMessage?: string;
}

/** Deterministic test double — never calls a live model. */
export class MockAdvisorCaptureProvider implements AIProvider {
  readonly providerName = "mock";
  readonly model = "mock-capture-v1";

  constructor(
    private readonly options: MockAdvisorCaptureProviderOptions = {},
  ) {}

  async generateNextBestAction(): Promise<never> {
    throw new Error("MockAdvisorCaptureProvider does not implement NBA");
  }

  async generateProductRecommendation(): Promise<never> {
    throw new Error(
      "MockAdvisorCaptureProvider does not implement product recommendation",
    );
  }

  async enrichCatalogueImportRow(): Promise<never> {
    throw new Error(
      "MockAdvisorCaptureProvider does not implement import enrichment",
    );
  }

  async generateGroundedAnswer(): Promise<never> {
    throw new Error(
      "MockAdvisorCaptureProvider does not implement grounded answers",
    );
  }

  async extractAdvisorCaptureBundles(): Promise<unknown> {
    if (this.options.failureMessage) {
      throw new Error(this.options.failureMessage);
    }
    return this.options.output ?? { bundles: [] };
  }
}
