/**
 * Provider-neutral corporate tender concept/moodboard image generation
 * (PHASE 18.10 / BD-110). Domain persistence and the explicit staff
 * approval gate before 18.3's public page can expose an image live
 * happen outside this package — same split as every other runner here.
 */

import type {
  AIProvider,
  ConceptImageContext,
  ConceptImageResult,
} from "./provider";

export interface ConceptGenerationJobOptions {
  readonly maxAttempts?: number;
}

export interface ConceptGenerationJobSuccess {
  readonly ok: true;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly result: ConceptImageResult;
}

export interface ConceptGenerationJobFailure {
  readonly ok: false;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly errorMessage: string;
}

export type ConceptGenerationJobResult =
  ConceptGenerationJobSuccess | ConceptGenerationJobFailure;

/** Runs one concept-image generation with bounded retries for transient
 * provider failures — the same shape `runAdvisorCaptureJob` already
 * uses. */
export async function runConceptGenerationJob(
  provider: AIProvider,
  context: ConceptImageContext,
  options: ConceptGenerationJobOptions = {},
): Promise<ConceptGenerationJobResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const started = Date.now();
  let attempts = 0;
  let lastError = "Concept image generation failed";

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const result = await provider.generateConceptImages(context);
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
          : "Concept image generation failed";
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

export interface MockConceptImageProviderOptions {
  readonly result?: ConceptImageResult;
  readonly failureMessage?: string;
}

/** Deterministic test double — never calls a live model. */
export class MockConceptImageProvider implements AIProvider {
  readonly providerName = "mock";
  readonly model = "mock-concept-v1";

  constructor(private readonly options: MockConceptImageProviderOptions = {}) {}

  async generateNextBestAction(): Promise<never> {
    throw new Error("MockConceptImageProvider does not implement NBA");
  }

  async generateProductRecommendation(): Promise<never> {
    throw new Error(
      "MockConceptImageProvider does not implement product recommendation",
    );
  }

  async enrichCatalogueImportRow(): Promise<never> {
    throw new Error(
      "MockConceptImageProvider does not implement import enrichment",
    );
  }

  async generateGroundedAnswer(): Promise<never> {
    throw new Error(
      "MockConceptImageProvider does not implement grounded answers",
    );
  }

  async extractAdvisorCaptureBundles(): Promise<never> {
    throw new Error(
      "MockConceptImageProvider does not implement advisor capture",
    );
  }

  async generateConceptImages(): Promise<ConceptImageResult> {
    if (this.options.failureMessage) {
      throw new Error(this.options.failureMessage);
    }
    return (
      this.options.result ?? {
        images: [
          {
            imageUrl: "https://example.test/mock-concept.png",
            revisedPrompt: "mock concept image",
          },
        ],
      }
    );
  }

  async generateWardrobeVisualization(): Promise<never> {
    throw new Error(
      "MockConceptImageProvider does not implement wardrobe visualization",
    );
  }
}
