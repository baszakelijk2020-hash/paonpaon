import {
  asId,
  type Conversation,
  type ConversationId,
  type CustomerId,
  type Message,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
const conversation = (row: ConversationRow): Conversation => ({
  id: asId<"ConversationId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  customerId: asId<"CustomerId">(row.customer_id),
  ...(row.last_message_at ? { lastMessageAt: row.last_message_at } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});
const message = (row: MessageRow): Message => ({
  id: asId<"MessageId">(row.id),
  conversationId: asId<"ConversationId">(row.conversation_id),
  senderType: row.sender_type,
  ...(row.sender_staff_id
    ? { senderStaffId: asId<"StaffId">(row.sender_staff_id) }
    : {}),
  ...(row.sender_user_id ? { senderUserId: row.sender_user_id } : {}),
  body: row.body,
  ...(row.read_by_customer_at
    ? { readByCustomerAt: row.read_by_customer_at }
    : {}),
  ...(row.read_by_staff_at ? { readByStaffAt: row.read_by_staff_at } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});
export class MessagingRepository {
  constructor(private readonly client: PaonSupabaseClient) {}
  async findConversation(id: ConversationId): Promise<Conversation | null> {
    const { data, error } = await this.client
      .from("conversations")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? conversation(data) : null;
  }
  async findByRetailer(retailerId: RetailerId): Promise<Conversation[]> {
    const { data, error } = await this.client
      .from("conversations")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data.map(conversation);
  }
  async findByCustomer(customerId: CustomerId): Promise<Conversation | null> {
    const { data, error } = await this.client
      .from("conversations")
      .select("*")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? conversation(data) : null;
  }
  async findMessages(id: ConversationId): Promise<Message[]> {
    const { data, error } = await this.client
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .is("deleted_at", null)
      .order("created_at");
    if (error) throw error;
    return data.map(message);
  }
  async getOrCreateForCustomer(
    retailerId: RetailerId,
  ): Promise<ConversationId> {
    const { data, error } = await this.client.rpc(
      "get_or_create_my_conversation",
      { p_retailer_id: retailerId },
    );
    if (error) throw error;
    return asId<"ConversationId">(data);
  }
  async getOrCreateForStaff(customerId: CustomerId): Promise<ConversationId> {
    const { data, error } = await this.client.rpc(
      "get_or_create_staff_conversation",
      { p_customer_id: customerId },
    );
    if (error) throw error;
    return asId<"ConversationId">(data);
  }
  async send(id: ConversationId, body: string): Promise<void> {
    const { error } = await this.client.rpc("send_conversation_message", {
      p_body: body,
      p_conversation_id: id,
    });
    if (error) throw error;
  }
  async markRead(id: ConversationId): Promise<void> {
    const { error } = await this.client.rpc("mark_conversation_read", {
      p_conversation_id: id,
    });
    if (error) throw error;
  }
}
