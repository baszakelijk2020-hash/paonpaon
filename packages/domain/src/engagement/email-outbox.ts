/**
 * Delivery infrastructure for `Notification` (`engagement/notification.ts`),
 * not a bounded-context entity of its own — enqueued only by the
 * `enqueue_notification_email` trigger, read/written only by the
 * scheduled drain Route Handler. See docs/DECISIONS.md ADR-032.
 */
export type EmailOutboxStatus = "pending" | "sending" | "sent" | "failed";

export interface EmailOutboxEntry {
  readonly id: string;
  readonly notificationId?: string;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly htmlBody: string;
  readonly status: EmailOutboxStatus;
  readonly attempts: number;
  readonly lastError?: string;
  readonly sentAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
