import type { Resend } from "resend";

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  providerMessageId: string;
}

/**
 * Thin wrapper over `resend.emails.send` — throws on failure (the
 * outbox drain loop, `@paon/database`'s `EmailOutboxRepository`, is
 * what turns a throw into a retry/failed record, not this function).
 */
export async function sendEmail(
  resend: Resend,
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const { data, error } = await resend.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Resend returned no data for a successful send");
  }
  return { providerMessageId: data.id };
}
