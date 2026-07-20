import "server-only";

import { createTwilioClient, type TwilioClient } from "@paon/sms";

import { env } from "./env";

/**
 * Returns `null`, not a throw, when Twilio credentials aren't
 * configured — the cron drain endpoint reports "not configured"
 * rather than crashing, same non-faking treatment as `lib/email.ts`.
 * Only `@paon/sms` lists `twilio` as a real dependency (ADR-001's
 * "never import a provider SDK type directly outside its wrapping
 * package" shape).
 */
export function getTwilioClient(): TwilioClient | null {
  const sid = env.twilioAccountSid;
  const token = env.twilioAuthToken;
  return sid && token ? createTwilioClient(sid, token) : null;
}
