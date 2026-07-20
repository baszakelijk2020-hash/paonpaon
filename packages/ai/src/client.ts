import OpenAI from "openai";

/**
 * Takes the API key as an explicit parameter rather than reading
 * `process.env` itself — same shape as `createStripeClient`
 * (`@paon/payments`) and `createResendClient` (`@paon/email`).
 */
export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}
