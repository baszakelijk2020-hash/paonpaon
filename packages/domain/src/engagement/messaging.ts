import type {
  ConversationId,
  CustomerId,
  MessageAttachmentId,
  MessageId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type ConversationIntent =
  "wedding" | "shirts" | "style_help" | "freeform";

/** A single thread between one Customer and one retailer (staff rotate within it). */
export interface Conversation extends Timestamps {
  readonly id: ConversationId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly lastMessageAt?: string;
  /** Set once, by whatever started the thread — a TableService storefront
   * inquiry (ADR-034) or an ordinary logged-in customer message, which
   * never sets it. Never overwritten on a later message. */
  readonly intent?: ConversationIntent;
}

export type MessageSenderType = "customer" | "staff" | "ai_assistant" | "guest";

/** Display labels for the TableService intent buttons (ADR-034) — the
 * only place this copy lives, so the customer-app widget and the
 * retailer inbox never drift apart. */
export const CONVERSATION_INTENT_LABELS: Record<ConversationIntent, string> = {
  wedding: "Wedding",
  shirts: "Shirts",
  style_help: "Style help",
  freeform: "General inquiry",
};

export interface Message extends Timestamps {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly senderType: MessageSenderType;
  readonly senderStaffId?: StaffId;
  readonly senderUserId?: string;
  readonly body: string;
  readonly readByCustomerAt?: string;
  readonly readByStaffAt?: string;
}

const ALLOWED_MESSAGE_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type MessageAttachmentMimeType =
  (typeof ALLOWED_MESSAGE_ATTACHMENT_MIME_TYPES)[number];
export const MESSAGE_ATTACHMENT_MIME_TYPES =
  ALLOWED_MESSAGE_ATTACHMENT_MIME_TYPES;

/** One uploaded image on a message — the `gcw-` chat widget's attach
 * panel / picture gallery. Sender identity is exactly one of
 * `uploadedByStaffId`/`uploadedByUserId`, matching who actually sent the
 * parent message (see `record_message_attachment`, ADR-037 follow-up). */
export interface MessageAttachment extends Pick<Timestamps, "createdAt"> {
  readonly id: MessageAttachmentId;
  readonly retailerId: RetailerId;
  readonly messageId: MessageId;
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly fileName: string;
  readonly mimeType: MessageAttachmentMimeType;
  readonly sizeBytes: number;
  readonly uploadedByStaffId?: StaffId;
  readonly uploadedByUserId?: string;
}
