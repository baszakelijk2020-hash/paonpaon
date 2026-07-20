import "server-only";

import { createResendClient, type Resend } from "@paon/email";

import { env } from "./env";

/**
 * Returns `null`, not a throw, when `RESEND_API_KEY` isn't configured
 * — the cron drain endpoint reports "not configured" rather than
 * crashing. Only `@paon/email` lists `resend` as a real dependency
 * (ADR-001's "never import a provider SDK type directly outside its
 * wrapping package" shape).
 */
export function getResendClient(): Resend | null {
  const apiKey = env.resendApiKey;
  return apiKey ? createResendClient(apiKey) : null;
}
