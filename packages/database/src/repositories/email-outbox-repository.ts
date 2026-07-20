import type { EmailOutboxEntry } from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type EmailOutboxRow = Database["public"]["Tables"]["email_outbox"]["Row"];

const MAX_ATTEMPTS = 5;

function toDomain(row: EmailOutboxRow): EmailOutboxEntry {
  return {
    id: row.id,
    ...(row.notification_id ? { notificationId: row.notification_id } : {}),
    recipientEmail: row.recipient_email,
    subject: row.subject,
    htmlBody: row.html_body,
    status: row.status as EmailOutboxEntry["status"],
    attempts: row.attempts,
    ...(row.last_error ? { lastError: row.last_error } : {}),
    ...(row.sent_at ? { sentAt: row.sent_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** See `docs/ARCHITECTURE.md` "Data access layer" — this repository is the only code allowed to query `email_outbox`. */
export class EmailOutboxRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /** Atomic claim (`for update skip locked` under the hood) — safe against overlapping drain runs. */
  async claimPending(limit = 20): Promise<EmailOutboxEntry[]> {
    const { data, error } = await this.client.rpc("claim_pending_emails", {
      p_limit: limit,
    });
    if (error) throw error;
    return data.map(toDomain);
  }

  async markSent(id: string): Promise<void> {
    const { error } = await this.client
      .from("email_outbox")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  /** Reverts to `pending` for another drain pass under `MAX_ATTEMPTS`, else permanently `failed`. */
  async markFailed(
    id: string,
    currentAttempts: number,
    errorMessage: string,
  ): Promise<void> {
    const attempts = currentAttempts + 1;
    const { error } = await this.client
      .from("email_outbox")
      .update({
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        attempts,
        last_error: errorMessage,
      })
      .eq("id", id);
    if (error) throw error;
  }
}
