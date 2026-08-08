import "server-only";

import {
  createOpenAIClient,
  MockCommunicationDraftProvider,
  OpenAIProvider,
  type AIProvider,
} from "@paon/ai";

import { env } from "./env";

/**
 * Returns `null`, not a throw, when `OPENAI_API_KEY` isn't configured
 * — callers render an "AI not configured" state rather than crashing,
 * the same non-faking treatment `docs/PROJECT_STATE.md` already
 * applies to unconfigured Stripe/Resend. Only `@paon/ai` lists
 * `openai` as a real dependency (ADR-001's "never import a provider
 * SDK type directly outside its wrapping package" shape). Swapping
 * providers later means adding another `AIProvider` implementation in
 * `@paon/ai` and changing only this one construction site.
 */
export function getAIProvider(): AIProvider | null {
  if (
    process.env.PAON_E2E_MOCK_AI === "1" &&
    isLoopbackSupabaseUrl(env.supabaseUrl)
  ) {
    return new MockCommunicationDraftProvider();
  }
  const apiKey = env.openaiApiKey;
  return apiKey ? new OpenAIProvider(createOpenAIClient(apiKey)) : null;
}

function isLoopbackSupabaseUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}
