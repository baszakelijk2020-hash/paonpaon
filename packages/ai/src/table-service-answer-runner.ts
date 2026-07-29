/**
 * Provider-neutral grounded TableService answer runner (PHASE 3.4).
 * Domain validation happens outside this package.
 */

import type { AIProvider } from "./provider";

export interface TableServiceAnswerKnowledgeSnippet {
  readonly knowledgeObjectId: string;
  readonly title: string;
  readonly summary: string;
}

export interface TableServiceAnswerProductSnippet {
  readonly productId: string;
  readonly name: string;
  readonly explanation: string;
}

export interface TableServiceAnswerContext {
  readonly retailerName: string;
  readonly occasionPhrase?: string;
  readonly question: string;
  readonly knowledge: readonly TableServiceAnswerKnowledgeSnippet[];
  readonly shortlist: readonly TableServiceAnswerProductSnippet[];
}

export interface TableServiceAnswerJobInput extends TableServiceAnswerContext {
  readonly idempotencyKey: string;
}

export interface TableServiceAnswerJobSuccess {
  readonly ok: true;
  readonly idempotencyKey: string;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly rawOutput: unknown;
}

export interface TableServiceAnswerJobFailure {
  readonly ok: false;
  readonly idempotencyKey: string;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly errorMessage: string;
}

export type TableServiceAnswerJobResult =
  | TableServiceAnswerJobSuccess
  | TableServiceAnswerJobFailure;

const TABLE_SERVICE_SYSTEM_PROMPT = `You are a premium menswear advisor assistant. Answer ONLY using the approved knowledge snippets and shortlist products provided. Never invent product facts, mills, composition, or styling rules.

Respond only as JSON:
{
  "body": string,
  "citations": string[],
  "citedProductIds": string[],
  "uncertainty": "low" | "medium" | "high",
  "refused": boolean,
  "handoffRecommended": boolean
}

Rules:
- Every citation id must come from the provided knowledge list.
- Every citedProductId must come from the provided shortlist.
- If the question cannot be answered from the provided material, set refused=true, handoffRecommended=true, and explain uncertainty honestly.
- Always set handoffRecommended=true when advising on weddings or high-value decisions.
- Keep body concise and customer-facing.`;

function buildUserPayload(context: TableServiceAnswerContext): string {
  return JSON.stringify(
    {
      retailer: context.retailerName,
      occasion: context.occasionPhrase ?? null,
      question: context.question,
      approvedKnowledge: context.knowledge,
      approvedShortlist: context.shortlist,
    },
    null,
    2,
  );
}

export async function runTableServiceAnswerJob(
  provider: AIProvider,
  input: TableServiceAnswerJobInput,
  options: { readonly maxAttempts?: number } = {},
): Promise<TableServiceAnswerJobResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const started = Date.now();
  let attempts = 0;
  let lastError = "TableService answer failed";

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const rawOutput = await provider.generateTableServiceAnswer({
        systemPrompt: TABLE_SERVICE_SYSTEM_PROMPT,
        userPayload: buildUserPayload(input),
      });
      return {
        ok: true,
        idempotencyKey: input.idempotencyKey,
        provider: provider.providerName,
        model: provider.model,
        latencyMs: Date.now() - started,
        attempts,
        rawOutput,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "TableService answer failed";
    }
  }

  return {
    ok: false,
    idempotencyKey: input.idempotencyKey,
    provider: provider.providerName,
    model: provider.model,
    latencyMs: Date.now() - started,
    attempts,
    errorMessage: lastError,
  };
}

/** Test double — returns fixed JSON without calling a live provider. */
export class MockTableServiceAnswerProvider implements AIProvider {
  readonly providerName = "mock";
  readonly model = "mock-table-service-v1";

  constructor(
    private readonly output: unknown,
    private readonly failureMessage?: string,
  ) {}

  async generateNextBestAction(): Promise<never> {
    throw new Error("MockTableServiceAnswerProvider does not support NBA");
  }

  async generateProductRecommendation(): Promise<never> {
    throw new Error(
      "MockTableServiceAnswerProvider does not support product recommendation",
    );
  }

  async enrichCatalogueImportRow(): Promise<never> {
    throw new Error(
      "MockTableServiceAnswerProvider does not support import enrichment",
    );
  }

  async generateTableServiceAnswer(): Promise<unknown> {
    if (this.failureMessage) {
      throw new Error(this.failureMessage);
    }
    return this.output;
  }
}

export { TABLE_SERVICE_SYSTEM_PROMPT, buildUserPayload };
