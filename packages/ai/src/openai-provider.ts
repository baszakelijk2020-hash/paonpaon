import type OpenAI from "openai";

import type {
  AdvisorCaptureContext,
  AIProvider,
  CatalogueImportEnrichmentContext,
  ConceptImageContext,
  ConceptImageResult,
  GroundedAnswerContext,
  GroundedAnswerResult,
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
  'You are a personal shopping assistant for a premium retailer. Given a customer\'s recent browsing activity, today\'s weather at the store (if given), and a short list of currently available products, pick exactly one product that best fits what they have been looking at — and the weather, when it\'s given and genuinely relevant to the choice — with a short one-sentence rationale written to the customer directly. Respond only as JSON: {"productId": string, "rationale": string}. productId must be exactly one of the given candidate ids.';

function buildRecommendationPrompt(
  context: ProductRecommendationContext,
): string {
  const candidateLines = context.candidates
    .map((c) => `- ${c.productId}: ${c.name} — ${c.description}`)
    .join("\n");
  const lines = [
    `Retailer: ${context.retailerName}`,
    `Customer: ${context.customerName}`,
    ...(context.weather
      ? [
          `Weather at the store today: ${context.weather.temperatureCelsius}°C, ${context.weather.description}`,
        ]
      : []),
    `Recent activity: ${context.recentEventNames.length ? context.recentEventNames.join(", ") : "none recorded"}`,
    `Candidates:\n${candidateLines}`,
  ];
  return lines.join("\n");
}

function buildEnrichmentUserPrompt(
  context: CatalogueImportEnrichmentContext,
): string {
  return JSON.stringify(
    {
      row: context.row,
      knownTaxonomy: context.knownTaxonomy,
    },
    null,
    2,
  );
}

const GROUNDED_SYSTEM_PROMPT =
  'You are TableService for a premium menswear retailer. Answer only from the approved knowledge cards and product shortlist provided. Never invent product facts, mills, prices, or stock. Express uncertainty when the basis is thin. Always leave room for a human advisor. Respond only as JSON: {"refuse": boolean, "refuseReason"?: string, "answerText": string, "uncertaintyNote"?: string, "knowledgeObjectIds": string[], "productIds": string[]}. knowledgeObjectIds and productIds must be subsets of the provided ids. If you cannot ground the answer, set refuse true.';

function buildGroundedPrompt(context: GroundedAnswerContext): string {
  return JSON.stringify(
    {
      retailer: context.retailerName,
      question: context.question,
      occasionLabel: context.occasionLabel ?? null,
      approvedKnowledge: context.knowledge,
      approvedProducts: context.products,
      rules: [
        "Cite only provided knowledgeObjectIds and productIds",
        "Do not invent facts",
        "Recommend advisor handoff for high-value or uncertain decisions",
      ],
    },
    null,
    2,
  );
}

function parseGroundedAnswer(
  parsed: unknown,
  context: GroundedAnswerContext,
): GroundedAnswerResult {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("OpenAI grounded answer was not an object");
  }
  const record = parsed as {
    refuse?: unknown;
    refuseReason?: unknown;
    answerText?: unknown;
    uncertaintyNote?: unknown;
    knowledgeObjectIds?: unknown;
    productIds?: unknown;
  };
  if (typeof record.answerText !== "string") {
    throw new Error("OpenAI grounded answer was missing answerText");
  }
  const refuse = record.refuse === true;
  const knowledgeObjectIds = Array.isArray(record.knowledgeObjectIds)
    ? record.knowledgeObjectIds.filter(
        (id): id is string => typeof id === "string",
      )
    : [];
  const productIds = Array.isArray(record.productIds)
    ? record.productIds.filter((id): id is string => typeof id === "string")
    : [];

  const allowedKnowledge = new Set(
    context.knowledge.map((item) => item.knowledgeObjectId),
  );
  const allowedProducts = new Set(
    context.products.map((item) => item.productId),
  );
  if (knowledgeObjectIds.some((id) => !allowedKnowledge.has(id))) {
    throw new Error(
      "OpenAI grounded answer cited knowledge outside the allowlist",
    );
  }
  if (productIds.some((id) => !allowedProducts.has(id))) {
    throw new Error(
      "OpenAI grounded answer cited a product outside the allowlist",
    );
  }

  return {
    refuse,
    ...(typeof record.refuseReason === "string"
      ? { refuseReason: record.refuseReason }
      : {}),
    answerText: record.answerText,
    ...(typeof record.uncertaintyNote === "string"
      ? { uncertaintyNote: record.uncertaintyNote }
      : {}),
    knowledgeObjectIds,
    productIds,
  };
}

const CAPTURE_SYSTEM_PROMPT = `You are an assistant that reads one advisor's note about a customer interaction and proposes a short list of confirmable action bundles. Never invent anything not implied by the note. Every bundle must quote a real, exact, contiguous substring of the note as "sourceExcerpt" — copy it verbatim, do not paraphrase it, and never propose a bundle with no excerpt.

Each bundle has one "kind":
- "self_portrait_fact": something to remember about the customer's taste or circumstances. payload: {"factType": one of "preference_concept"|"occasion"|"employer"|"industry"|"bonus_month"|"anniversary"|"wedding_date"|"travel_window"|"fit_note"|"fabric_interest"|"colour_interest"|"pattern_interest"|"rejected_concept"|"other", "valueLabel": short string}.
- "follow_up": a commitment or promise to act later. payload: {"whyNow": short string explaining why this follow-up exists, "suggestedAction": short string of what to do, "dueAt": optional ISO date if a date was mentioned, resolved against the given "as of" date, "channel": optional one of "in_person"|"message"|"email"|"phone"|"appointment"}.
- "task_note": anything else worth keeping that doesn't fit the above. payload: {"note": short string}.

Respond only as JSON: {"bundles": [{"kind": string, "summary": short string, "sourceExcerpt": string, "confidence": number between 0 and 1, "payload": object}]}. Return an empty array if the note has nothing actionable. Never merge two unrelated topics into one bundle.`;

function buildCapturePrompt(context: AdvisorCaptureContext): string {
  return JSON.stringify(
    {
      retailer: context.retailerName,
      customer: context.customerName ?? "unspecified",
      asOfDate: context.asOfDate,
      note: context.rawText,
    },
    null,
    2,
  );
}

const DEFAULT_IMAGE_MODEL = "dall-e-3";

function buildConceptImagePrompt(context: ConceptImageContext): string {
  const lines = [
    `A photorealistic tailoring moodboard for ${context.retailerName}'s corporate wardrobe tender "${context.tenderTitle}".`,
    `Garment concepts: ${context.garmentConcepts.join(", ")}.`,
    ...(context.styleNotes ? [`Style notes: ${context.styleNotes}.`] : []),
    "Studio lighting, premium menswear editorial style, no visible text or logos.",
  ];
  return lines.join(" ");
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

  async enrichCatalogueImportRow(
    context: CatalogueImportEnrichmentContext,
  ): Promise<unknown> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: context.systemPrompt },
        { role: "user", content: buildEnrichmentUserPrompt(context) },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error("OpenAI returned no content for import enrichment");
    }

    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new Error("OpenAI import enrichment response was not valid JSON");
    }
  }

  async generateGroundedAnswer(
    context: GroundedAnswerContext,
  ): Promise<GroundedAnswerResult> {
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

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: GROUNDED_SYSTEM_PROMPT },
        { role: "user", content: buildGroundedPrompt(context) },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error("OpenAI returned no content for grounded answer");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("OpenAI grounded answer was not valid JSON");
    }
    return parseGroundedAnswer(parsed, context);
  }

  async extractAdvisorCaptureBundles(
    context: AdvisorCaptureContext,
  ): Promise<unknown> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: CAPTURE_SYSTEM_PROMPT },
        { role: "user", content: buildCapturePrompt(context) },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error("OpenAI returned no content for advisor capture");
    }

    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new Error("OpenAI advisor capture response was not valid JSON");
    }
  }

  async generateConceptImages(
    context: ConceptImageContext,
  ): Promise<ConceptImageResult> {
    const prompt = buildConceptImagePrompt(context);
    const response = await this.client.images.generate({
      model: DEFAULT_IMAGE_MODEL,
      prompt,
      n: 1,
      size: "1024x1024",
    });

    const images = (response.data ?? []).map((item) => {
      if (!item.url) {
        throw new Error("OpenAI concept image response was missing a url");
      }
      return {
        imageUrl: item.url,
        revisedPrompt: item.revised_prompt ?? prompt,
      };
    });
    if (images.length === 0) {
      throw new Error("OpenAI returned no concept images");
    }
    return { images };
  }
}
