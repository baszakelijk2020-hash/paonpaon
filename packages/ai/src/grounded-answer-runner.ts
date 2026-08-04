/**
 * Provider-neutral TableService grounded-answer helper (PHASE 3.4).
 * Domain citation validation remains the caller's responsibility after
 * mapping into `@paon/domain` GroundedAnswer shapes.
 */

import type {
  AIProvider,
  GroundedAnswerContext,
  GroundedAnswerResult,
} from "./provider";

export interface MockGroundedAnswerProviderOptions {
  readonly result?: GroundedAnswerResult;
  readonly errorMessage?: string;
}

/**
 * Deterministic mock for tests and offline orchestration — never calls a
 * live model. Returns an allowlisted refusal or the provided result.
 */
export class MockGroundedAnswerProvider implements AIProvider {
  readonly providerName = "mock";
  readonly model = "mock-grounded";

  constructor(
    private readonly options: MockGroundedAnswerProviderOptions = {},
  ) {}

  async generateNextBestAction(): Promise<never> {
    throw new Error("MockGroundedAnswerProvider does not implement NBA");
  }

  async generateProductRecommendation(): Promise<never> {
    throw new Error(
      "MockGroundedAnswerProvider does not implement product recommendation",
    );
  }

  async enrichCatalogueImportRow(): Promise<never> {
    throw new Error(
      "MockGroundedAnswerProvider does not implement import enrichment",
    );
  }

  async generateGroundedAnswer(
    context: GroundedAnswerContext,
  ): Promise<GroundedAnswerResult> {
    if (this.options.errorMessage) {
      throw new Error(this.options.errorMessage);
    }
    if (this.options.result) {
      return this.options.result;
    }
    if (context.knowledge.length === 0 && context.products.length === 0) {
      return {
        refuse: true,
        refuseReason: "no_approved_basis",
        answerText:
          "I don't have approved knowledge to answer that confidently yet. An advisor can help in person or over message.",
        knowledgeObjectIds: [],
        productIds: [],
      };
    }
    return {
      refuse: false,
      answerText: `Grounded mock answer for ${context.occasionLabel ?? "your request"} using approved knowledge.`,
      uncertaintyNote:
        "In-store fabric books and advisor expertise refine the final choice.",
      knowledgeObjectIds: context.knowledge
        .slice(0, 3)
        .map((item) => item.knowledgeObjectId),
      productIds: context.products.slice(0, 4).map((item) => item.productId),
    };
  }

  async extractAdvisorCaptureBundles(): Promise<never> {
    throw new Error(
      "MockGroundedAnswerProvider does not implement advisor capture",
    );
  }

  async generateConceptImages(): Promise<never> {
    throw new Error(
      "MockGroundedAnswerProvider does not implement concept images",
    );
  }
}

export async function runGroundedAnswerJob(
  provider: AIProvider,
  context: GroundedAnswerContext,
): Promise<{
  readonly ok: boolean;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly result?: GroundedAnswerResult;
  readonly errorMessage?: string;
}> {
  const started = Date.now();
  try {
    const result = await provider.generateGroundedAnswer(context);
    return {
      ok: true,
      provider: provider.providerName,
      model: provider.model,
      latencyMs: Date.now() - started,
      result,
    };
  } catch (error) {
    return {
      ok: false,
      provider: provider.providerName,
      model: provider.model,
      latencyMs: Date.now() - started,
      errorMessage:
        error instanceof Error ? error.message : "Grounded answer failed",
    };
  }
}
