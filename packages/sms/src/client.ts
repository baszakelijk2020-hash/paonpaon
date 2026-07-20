import twilio from "twilio";

/** Re-exported so a calling app's `lib/sms.ts` never has to import
 * `twilio` directly — ADR-001's "never import a provider SDK type
 * outside its wrapping package" shape, same as `@paon/email`'s `Resend`. */
export type TwilioClient = twilio.Twilio;

/**
 * Takes credentials as explicit parameters rather than reading
 * `process.env` itself — same shape as `createResendClient`
 * (`@paon/email`) and `createSupabaseAdminClient` (`@paon/database`),
 * so every credential stays owned by the calling app's own `lib/env.ts`.
 */
export function createTwilioClient(
  accountSid: string,
  authToken: string,
): TwilioClient {
  return twilio(accountSid, authToken);
}
