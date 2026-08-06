import "server-only";

import { createOpenAIClient, OpenAIProvider, type AIProvider } from "@paon/ai";

import { env } from "./env";

/**
 * Returns `null`, not a throw, when `OPENAI_API_KEY` isn't configured
 * — the same non-faking treatment as `apps/retailer/lib/ai.ts` and
 * `apps/customer/lib/ai.ts` (ADR-033).
 */
export function getAIProvider(): AIProvider | null {
  const apiKey = env.openaiApiKey;
  return apiKey ? new OpenAIProvider(createOpenAIClient(apiKey)) : null;
}
