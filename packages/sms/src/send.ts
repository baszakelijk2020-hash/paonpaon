import type { TwilioClient } from "./client";

export type TextChannel = "sms" | "whatsapp";

export interface SendTextParams {
  channel: TextChannel;
  from: string;
  to: string;
  body: string;
}

export interface SendTextResult {
  providerMessageId: string;
}

function withChannelPrefix(channel: TextChannel, value: string): string {
  return channel === "whatsapp" ? `whatsapp:${value}` : value;
}

/**
 * Thin wrapper over `client.messages.create` — throws on failure (the
 * outbox drain loop, `@paon/database`'s `SmsOutboxRepository`, is what
 * turns a throw into a retry/failed record, not this function). SMS
 * and WhatsApp share this one call — Twilio only differs by whether
 * `from`/`to` carry a `whatsapp:` prefix.
 */
export async function sendText(
  client: TwilioClient,
  params: SendTextParams,
): Promise<SendTextResult> {
  const message = await client.messages.create({
    from: withChannelPrefix(params.channel, params.from),
    to: withChannelPrefix(params.channel, params.to),
    body: params.body,
  });
  if (message.errorMessage) {
    throw new Error(message.errorMessage);
  }
  return { providerMessageId: message.sid };
}
