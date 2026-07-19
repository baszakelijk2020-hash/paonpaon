import type {
  CustomerId,
  NotificationId,
  RetailerId,
  UserId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type NotificationChannel = "email" | "sms" | "push" | "in_app";

export type NotificationCategory =
  | "order_update"
  | "production_update"
  | "alteration_update"
  | "appointment_reminder"
  | "loyalty_update"
  | "marketing"
  | "system";

export interface Notification extends Timestamps {
  readonly id: NotificationId;
  readonly retailerId: RetailerId;
  readonly recipientUserId: UserId;
  readonly customerId?: CustomerId;
  readonly channel: NotificationChannel;
  readonly category: NotificationCategory;
  readonly title: string;
  readonly body: string;
  readonly readAt?: string;
  readonly sentAt?: string;
}
