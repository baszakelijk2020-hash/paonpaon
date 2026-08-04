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

export interface CatalogueImportEnrichmentContext {
  readonly systemPrompt: string;
  readonly row: {
    readonly externalSku?: string;
    readonly name?: string;
    readonly description?: string;
    readonly supplierFacts: Readonly<Record<string, string>>;
  };
  readonly knownTaxonomy: readonly {
    readonly kind: string;
    readonly slug: string;
    readonly canonicalName: string;
  }[];
}

/** Approved knowledge + catalogue shortlist only (ADV-001 / ADR-060). */
export interface GroundedAnswerKnowledgeCandidate {
  readonly knowledgeObjectId: string;
  readonly title: string;
  readonly summary: string;
}

export interface GroundedAnswerProductCandidate {
  readonly productId: string;
  readonly name: string;
  readonly explanation: string;
}

export interface GroundedAnswerContext {
  readonly retailerName: string;
  readonly question: string;
  readonly occasionLabel?: string;
  readonly knowledge: readonly GroundedAnswerKnowledgeCandidate[];
  readonly products: readonly GroundedAnswerProductCandidate[];
}

export interface GroundedAnswerResult {
  readonly refuse: boolean;
  readonly refuseReason?: string;
  readonly answerText: string;
  readonly uncertaintyNote?: string;
  readonly knowledgeObjectIds: readonly string[];
  readonly productIds: readonly string[];
}

/** One advisor note/voice/photo capture — the raw text is already
 * transcribed by the time it reaches this context; speech-to-text is a
 * separate, swappable concern from the extraction call itself. */
export interface AdvisorCaptureContext {
  readonly rawText: string;
  readonly retailerName: string;
  readonly customerName?: string;
  /** ISO date, so the model can resolve "Friday" or "next month" against
   * a real anchor instead of guessing one. */
  readonly asOfDate: string;
}

/** One tender's garment concepts, turned into a moodboard/concept image
 * request (PHASE 18.10 / BD-110). Never fed pricing or client-identifying
 * detail — only the same descriptive content already externally visible
 * once a tender is approved and shared (18.3). */
export interface ConceptImageContext {
  readonly retailerName: string;
  readonly tenderTitle: string;
  readonly garmentConcepts: readonly string[];
  readonly styleNotes?: string;
}

export interface ConceptImageResult {
  readonly images: readonly {
    readonly imageUrl: string;
    readonly revisedPrompt: string;
  }[];
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
  /**
   * Returns parsed JSON from the model. Domain validation and pending
   * review persistence happen outside this package (IMP-003).
   */
  enrichCatalogueImportRow(
    context: CatalogueImportEnrichmentContext,
  ): Promise<unknown>;
  /**
   * Structured TableService answer grounded only on the provided
   * approved knowledge and product allowlist (ADV-001).
   */
  generateGroundedAnswer(
    context: GroundedAnswerContext,
  ): Promise<GroundedAnswerResult>;
  /**
   * Returns parsed JSON (an array of proposed capture bundles) from the
   * model. `checkCaptureBundleProposal` (`@paon/domain`) validates every
   * bundle outside this package before it is ever shown to an advisor,
   * same split as `enrichCatalogueImportRow`.
   */
  extractAdvisorCaptureBundles(
    context: AdvisorCaptureContext,
  ): Promise<unknown>;
  /**
   * Generates corporate tender moodboard/concept images (18.10). The
   * result is never shown externally on its own authority — persistence
   * and the explicit staff approval gate before 18.3's public page can
   * expose it live outside this package.
   */
  generateConceptImages(
    context: ConceptImageContext,
  ): Promise<ConceptImageResult>;
}
