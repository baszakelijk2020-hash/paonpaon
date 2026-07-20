import type OpenAI from "openai";

import type {
  AIProvider,
  NextBestActionContext,
  NextBestActionResult,
  ProductRecommendationContext,
  ProductRecommendationResult,
} from "./provider";

const DEFAULT_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  'You are a clienteling assistant for a premium retail sales associate. Given a customer\'s recent activity, suggest exactly one concrete next action the associate should take and a short rationale. Respond only as JSON: {"action": string, "rationale": string}.';

function buildUserPrompt(context: NextBestActionContext): string {
  const lines = [
    `Retailer: ${context.retailerName}`,
    `Customer: ${context.customerName}`,
    `Lifecycle stage: ${context.lifecycleStage}`,
    `Recent activity: ${context.recentEventNames.length ? context.recentEventNames.join(", ") : "none recorded"}`,
    `Recent orders: ${context.recentOrderSummaries.length ? context.recentOrderSummaries.join(", ") : "none"}`,
  ];
  return lines.join("\n");
}

const RECOMMENDATION_SYSTEM_PROMPT =
  'You are a personal shopping assistant for a premium retailer. Given a customer\'s recent browsing activity and a short list of currently available products, pick exactly one product that best fits what they have been looking at, with a short one-sentence rationale written to the customer directly. Respond only as JSON: {"productId": string, "rationale": string}. productId must be exactly one of the given candidate ids.';

function buildRecommendationPrompt(
  context: ProductRecommendationContext,
): string {
  const candidateLines = context.candidates
    .map((c) => `- ${c.productId}: ${c.name} — ${c.description}`)
    .join("\n");
  const lines = [
    `Retailer: ${context.retailerName}`,
    `Customer: ${context.customerName}`,
    `Recent activity: ${context.recentEventNames.length ? context.recentEventNames.join(", ") : "none recorded"}`,
    `Candidates:\n${candidateLines}`,
  ];
  return lines.join("\n");
}

export class OpenAIProvider implements AIProvider {
  readonly providerName = "openai";

  constructor(
    private readonly client: OpenAI,
    readonly model: string = DEFAULT_MODEL,
  ) {}

  async generateNextBestAction(
    context: NextBestActionContext,
  ): Promise<NextBestActionResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(context) },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error("OpenAI returned no content");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("OpenAI response was not valid JSON");
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { action?: unknown }).action !== "string" ||
      typeof (parsed as { rationale?: unknown }).rationale !== "string"
    ) {
      throw new Error("OpenAI response was missing action/rationale");
    }

    return {
      action: (parsed as { action: string }).action,
      rationale: (parsed as { rationale: string }).rationale,
    };
  }

  async generateProductRecommendation(
    context: ProductRecommendationContext,
  ): Promise<ProductRecommendationResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: RECOMMENDATION_SYSTEM_PROMPT },
        { role: "user", content: buildRecommendationPrompt(context) },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error("OpenAI returned no content");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("OpenAI response was not valid JSON");
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { productId?: unknown }).productId !== "string" ||
      typeof (parsed as { rationale?: unknown }).rationale !== "string"
    ) {
      throw new Error("OpenAI response was missing productId/rationale");
    }
    const productId = (parsed as { productId: string }).productId;
    if (!context.candidates.some((c) => c.productId === productId)) {
      throw new Error(
        "OpenAI recommended a product outside the candidate list",
      );
    }

    return {
      productId,
      rationale: (parsed as { rationale: string }).rationale,
    };
  }
}
