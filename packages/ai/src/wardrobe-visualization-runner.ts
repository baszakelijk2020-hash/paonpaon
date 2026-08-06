/**
 * Provider-neutral Virtual Wardrobe Studio image generation (VWS-001 /
 * PHASE 4.6 / ADR-074). Domain persistence (the immutable job snapshot,
 * status transitions, the copy into PAON-controlled Storage) happens
 * outside this package — same split as `concept-generation-runner.ts`.
 */

import type {
  AIProvider,
  WardrobeVisualizationContext,
  WardrobeVisualizationResult,
} from "./provider";

export interface WardrobeVisualizationJobOptions {
  readonly maxAttempts?: number;
}

export interface WardrobeVisualizationJobSuccess {
  readonly ok: true;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly result: WardrobeVisualizationResult;
}

export interface WardrobeVisualizationJobFailure {
  readonly ok: false;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly errorMessage: string;
}

export type WardrobeVisualizationJobResult =
  WardrobeVisualizationJobSuccess | WardrobeVisualizationJobFailure;

/** Runs one wardrobe-visualization generation with bounded retries for
 * transient provider failures — the same shape `runConceptGenerationJob`
 * already uses. */
export async function runWardrobeVisualizationJob(
  provider: AIProvider,
  context: WardrobeVisualizationContext,
  options: WardrobeVisualizationJobOptions = {},
): Promise<WardrobeVisualizationJobResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const started = Date.now();
  let attempts = 0;
  let lastError = "Wardrobe visualization generation failed";

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const result = await provider.generateWardrobeVisualization(context);
      return {
        ok: true,
        provider: provider.providerName,
        model: provider.model,
        latencyMs: Date.now() - started,
        attempts,
        result,
      };
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Wardrobe visualization generation failed";
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

export interface MockWardrobeVisualizationProviderOptions {
  readonly result?: WardrobeVisualizationResult;
  readonly failureMessage?: string;
}

/** Deterministic test double — never calls a live model. */
export class MockWardrobeVisualizationProvider implements AIProvider {
  readonly providerName = "mock";
  readonly model = "mock-wardrobe-visualization-v1";

  constructor(
    private readonly options: MockWardrobeVisualizationProviderOptions = {},
  ) {}

  async generateNextBestAction(): Promise<never> {
    throw new Error("MockWardrobeVisualizationProvider does not implement NBA");
  }

  async generateProductRecommendation(): Promise<never> {
    throw new Error(
      "MockWardrobeVisualizationProvider does not implement product recommendation",
    );
  }

  async enrichCatalogueImportRow(): Promise<never> {
    throw new Error(
      "MockWardrobeVisualizationProvider does not implement import enrichment",
    );
  }

  async generateGroundedAnswer(): Promise<never> {
    throw new Error(
      "MockWardrobeVisualizationProvider does not implement grounded answers",
    );
  }

  async extractAdvisorCaptureBundles(): Promise<never> {
    throw new Error(
      "MockWardrobeVisualizationProvider does not implement advisor capture",
    );
  }

  async generateConceptImages(): Promise<never> {
    throw new Error(
      "MockWardrobeVisualizationProvider does not implement concept images",
    );
  }

  async generateWardrobeVisualization(): Promise<WardrobeVisualizationResult> {
    if (this.options.failureMessage) {
      throw new Error(this.options.failureMessage);
    }
    return (
      this.options.result ?? {
        imageUrl: "https://example.test/mock-wardrobe-visualization.png",
        revisedPrompt: "mock wardrobe visualization",
      }
    );
  }
}
