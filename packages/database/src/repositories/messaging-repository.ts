import {
  asId,
  type Conversation,
  type ConversationId,
  type ConversationIntent,
  type CustomerId,
  type Message,
  type MessageAttachment,
  type MessageAttachmentMimeType,
  type MessageId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type MessageAttachmentRow =
  Database["public"]["Tables"]["message_attachments"]["Row"];
const conversation = (row: ConversationRow): Conversation => ({
  id: asId<"ConversationId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  customerId: asId<"CustomerId">(row.customer_id),
  ...(row.last_message_at ? { lastMessageAt: row.last_message_at } : {}),
  ...(row.intent ? { intent: row.intent as ConversationIntent } : {}),
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
const messageAttachment = (row: MessageAttachmentRow): MessageAttachment => ({
  id: asId<"MessageAttachmentId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  messageId: asId<"MessageId">(row.message_id),
  storageBucket: row.storage_bucket,
  storagePath: row.storage_path,
  fileName: row.file_name,
  mimeType: row.mime_type as MessageAttachmentMimeType,
  sizeBytes: row.size_bytes,
  ...(row.uploaded_by_staff_id
    ? { uploadedByStaffId: asId<"StaffId">(row.uploaded_by_staff_id) }
    : {}),
  ...(row.uploaded_by_user_id
    ? { uploadedByUserId: row.uploaded_by_user_id }
    : {}),
  createdAt: row.created_at,
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
  /** Returns the new message's id — the attach-file flow needs it right
   * after sending to attribute an upload to the message it belongs to. */
  async send(id: ConversationId, body: string): Promise<MessageId> {
    const { data, error } = await this.client.rpc("send_conversation_message", {
      p_body: body,
      p_conversation_id: id,
    });
    if (error) throw error;
    return asId<"MessageId">(data);
  }
  async markRead(id: ConversationId): Promise<void> {
    const { error } = await this.client.rpc("mark_conversation_read", {
      p_conversation_id: id,
    });
    if (error) throw error;
  }

  /** The one write path an anonymous storefront visitor can reach —
   * `submit_table_service_inquiry` finds-or-creates the guest Customer
   * and Conversation itself (ADR-034); this repository does not expose
   * any other anonymous-safe insert. */
  async submitTableServiceInquiry(params: {
    retailerId: RetailerId;
    name: string;
    email: string;
    intent: ConversationIntent;
    message: string;
  }): Promise<ConversationId> {
    const { data, error } = await this.client.rpc(
      "submit_table_service_inquiry",
      {
        p_retailer_id: params.retailerId,
        p_name: params.name,
        p_email: params.email,
        p_intent: params.intent,
        p_message: params.message,
      },
    );
    if (error) throw error;
    return asId<"ConversationId">(data);
  }

  /** Signed URLs, same 15-minute-expiry shape as
   * AlterationAttachmentRepository.findByAlteration — never a public URL,
   * this bucket is private. */
  async findAttachmentsByConversation(
    conversationId: ConversationId,
  ): Promise<{ attachment: MessageAttachment; signedUrl: string }[]> {
    const { data: messageRows, error: messagesError } = await this.client
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId);
    if (messagesError) throw messagesError;
    const messageIds = messageRows.map((row) => row.id);
    if (messageIds.length === 0) return [];

    const { data, error } = await this.client
      .from("message_attachments")
      .select("*")
      .in("message_id", messageIds)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return Promise.all(
      data.map(async (row) => {
        const attachment = messageAttachment(row);
        const { data: signed, error: signedError } = await this.client.storage
          .from(attachment.storageBucket)
          .createSignedUrl(attachment.storagePath, 15 * 60);
        if (signedError) throw signedError;
        return { attachment, signedUrl: signed.signedUrl };
      }),
    );
  }

  async uploadAttachment(params: {
    retailerId: RetailerId;
    conversationId: ConversationId;
    messageId: MessageId;
    fileName: string;
    mimeType: MessageAttachmentMimeType;
    sizeBytes: number;
    content: ArrayBuffer;
  }): Promise<MessageAttachment> {
    const storagePath = `${params.retailerId}/${params.conversationId}/${Date.now()}-${params.fileName}`;
    const { error: uploadError } = await this.client.storage
      .from("message-attachments")
      .upload(storagePath, params.content, {
        contentType: params.mimeType,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data, error } = await this.client.rpc("record_message_attachment", {
      p_message_id: params.messageId,
      p_storage_path: storagePath,
      p_file_name: params.fileName,
      p_mime_type: params.mimeType,
      p_size_bytes: params.sizeBytes,
    });
    if (error) throw error;

    const { data: row, error: fetchError } = await this.client
      .from("message_attachments")
      .select("*")
      .eq("id", data)
      .single();
    if (fetchError) throw fetchError;
    return messageAttachment(row);
  }
}
