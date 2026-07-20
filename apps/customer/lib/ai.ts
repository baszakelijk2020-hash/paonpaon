import "server-only";

import { createOpenAIClient, OpenAIProvider, type AIProvider } from "@paon/ai";

import { env } from "./env";

/**
 * Returns `null`, not a throw, when `OPENAI_API_KEY` isn't configured
 * — the same non-faking treatment as `apps/retailer/lib/ai.ts`
 * (ADR-033) and the construction site "Today's Pick" (ADR-035) uses.
 */
export function getAIProvider(): AIProvider | null {
  const apiKey = env.openaiApiKey;
  return apiKey ? new OpenAIProvider(createOpenAIClient(apiKey)) : null;
}
