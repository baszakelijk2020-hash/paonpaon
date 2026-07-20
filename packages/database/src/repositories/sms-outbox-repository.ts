import type { SmsOutboxEntry } from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type SmsOutboxRow = Database["public"]["Tables"]["sms_outbox"]["Row"];

const MAX_ATTEMPTS = 5;

function toDomain(row: SmsOutboxRow): SmsOutboxEntry {
  return {
    id: row.id,
    ...(row.notification_id ? { notificationId: row.notification_id } : {}),
    channel: row.channel as SmsOutboxEntry["channel"],
    recipientPhone: row.recipient_phone,
    body: row.body,
    status: row.status as SmsOutboxEntry["status"],
    attempts: row.attempts,
    ...(row.last_error ? { lastError: row.last_error } : {}),
    ...(row.sent_at ? { sentAt: row.sent_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** See `docs/ARCHITECTURE.md` "Data access layer" — the only code
 * allowed to query `sms_outbox`. Mirrors `EmailOutboxRepository`. */
export class SmsOutboxRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async claimPending(limit = 20): Promise<SmsOutboxEntry[]> {
    const { data, error } = await this.client.rpc("claim_pending_sms", {
      p_limit: limit,
    });
    if (error) throw error;
    return data.map(toDomain);
  }

  async markSent(id: string): Promise<void> {
    const { error } = await this.client
      .from("sms_outbox")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  async markFailed(
    id: string,
    currentAttempts: number,
    errorMessage: string,
  ): Promise<void> {
    const attempts = currentAttempts + 1;
    const { error } = await this.client
      .from("sms_outbox")
      .update({
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        attempts,
        last_error: errorMessage,
      })
      .eq("id", id);
    if (error) throw error;
  }
}
