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

export interface AIProvider {
  readonly providerName: string;
  readonly model: string;
  generateNextBestAction(
    context: NextBestActionContext,
  ): Promise<NextBestActionResult>;
}
