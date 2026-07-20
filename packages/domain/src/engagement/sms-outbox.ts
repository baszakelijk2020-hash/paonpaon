/**
 * Delivery infrastructure for `Notification`, same relationship
 * `EmailOutboxEntry` has — enqueued only by the `enqueue_notification_sms`
 * trigger, read/written only by the scheduled drain Route Handler.
 * Covers both SMS and WhatsApp (`channel`); Twilio handles both
 * through one client.
 */
export type SmsOutboxStatus = "pending" | "sending" | "sent" | "failed";
export type SmsOutboxChannel = "sms" | "whatsapp";

export interface SmsOutboxEntry {
  readonly id: string;
  readonly notificationId?: string;
  readonly channel: SmsOutboxChannel;
  readonly recipientPhone: string;
  readonly body: string;
  readonly status: SmsOutboxStatus;
  readonly attempts: number;
  readonly lastError?: string;
  readonly sentAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
