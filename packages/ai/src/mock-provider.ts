import type {
  AIProvider,
  CatalogueImportEnrichmentContext,
  CatalogueImportEnrichmentResult,
  NextBestActionContext,
  NextBestActionResult,
  ProductRecommendationContext,
  ProductRecommendationResult,
} from "./provider";

/**
 * Deterministic provider for tests and offline orchestration. Returns a
 * preconfigured enrichment payload or throws when enrichment is unset.
 */
export class MockAIProvider implements AIProvider {
  readonly providerName = "mock";
  readonly model: string;

  private nextBestActionResult: NextBestActionResult | null = null;
  private productRecommendationResult: ProductRecommendationResult | null =
    null;
  private enrichmentResult: CatalogueImportEnrichmentResult | null = null;
  private enrichmentError: Error | null = null;

  constructor(model = "mock-model") {
    this.model = model;
  }

  setNextBestAction(result: NextBestActionResult): this {
    this.nextBestActionResult = result;
    return this;
  }

  setProductRecommendation(result: ProductRecommendationResult): this {
    this.productRecommendationResult = result;
    return this;
  }

  setEnrichment(result: CatalogueImportEnrichmentResult): this {
    this.enrichmentResult = result;
    this.enrichmentError = null;
    return this;
  }

  setEnrichmentError(error: Error): this {
    this.enrichmentError = error;
    this.enrichmentResult = null;
    return this;
  }

  async generateNextBestAction(
    _context: NextBestActionContext,
  ): Promise<NextBestActionResult> {
    if (!this.nextBestActionResult) {
      throw new Error("Mock next best action not configured");
    }
    return this.nextBestActionResult;
  }

  async generateProductRecommendation(
    context: ProductRecommendationContext,
  ): Promise<ProductRecommendationResult> {
    if (!this.productRecommendationResult) {
      throw new Error("Mock product recommendation not configured");
    }
    if (
      !context.candidates.some(
        (candidate) =>
          candidate.productId === this.productRecommendationResult?.productId,
      )
    ) {
      throw new Error(
        "Mock product recommendation productId is outside candidate list",
      );
    }
    return this.productRecommendationResult;
  }

  async enrichCatalogueImportRow(
    _context: CatalogueImportEnrichmentContext,
  ): Promise<CatalogueImportEnrichmentResult> {
    if (this.enrichmentError) {
      throw this.enrichmentError;
    }
    if (!this.enrichmentResult) {
      throw new Error("Mock enrichment not configured");
    }
    return this.enrichmentResult;
  }
}
