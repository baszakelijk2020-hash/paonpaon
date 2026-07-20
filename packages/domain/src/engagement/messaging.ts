import type {
  ConversationId,
  CustomerId,
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
