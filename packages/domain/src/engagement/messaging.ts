import type {
  ConversationId,
  CustomerId,
  MessageId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

/** A single thread between one Customer and one retailer (staff rotate within it). */
export interface Conversation extends Timestamps {
  readonly id: ConversationId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly lastMessageAt?: string;
}

export type MessageSenderType = "customer" | "staff" | "ai_assistant";

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
