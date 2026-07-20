/**
 * Founder decision: OpenAI, behind a provider-neutral interface so the
 * provider stays replaceable — this is the interface every provider
 * implements; nothing outside this package or the app-level `lib/ai.ts`
 * that constructs a provider should import an SDK type directly. See
 * docs/DECISIONS.md ADR-033.
 */
export interface NextBestActionContext {
  retailerName: string;
  customerName: string;
  lifecycleStage: string;
  recentEventNames: readonly string[];
  recentOrderSummaries: readonly string[];
}

export interface NextBestActionResult {
  action: string;
  rationale: string;
}

/** One candidate product per recommendation call — the customer app
 * passes a small active-catalog slice, never the full catalog, to keep
 * the prompt bounded. */
export interface ProductRecommendationCandidate {
  productId: string;
  name: string;
  description: string;
}

export interface ProductRecommendationContext {
  retailerName: string;
  customerName: string;
  recentEventNames: readonly string[];
  candidates: readonly ProductRecommendationCandidate[];
  /** Current weather at the retailer's store (ADR-035
   * MorningRoutine) — omitted when OPENWEATHER_API_KEY isn't
   * configured, never fabricated. */
  weather?: { temperatureCelsius: number; description: string };
}

export interface ProductRecommendationResult {
  productId: string;
  rationale: string;
}

export interface AIProvider {
  readonly providerName: string;
  readonly model: string;
  generateNextBestAction(
    context: NextBestActionContext,
  ): Promise<NextBestActionResult>;
  generateProductRecommendation(
    context: ProductRecommendationContext,
  ): Promise<ProductRecommendationResult>;
}
