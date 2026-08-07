import {
  asId,
  type BuyingIntentClassification,
  type Conversation,
  type ConversationId,
  type ConversationIntent,
  type ConversationStatus,
  type CustomerId,
  type Message,
  type MessageAttachment,
  type MessageAttachmentMimeType,
  type MessageAttachmentPurpose,
  type MessageId,
  type RetailerId,
  type WardrobeItemId,
  type WeddingPartyId,
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
  ...(row.outcome_appointment_id
    ? { outcomeAppointmentId: row.outcome_appointment_id }
    : {}),
  ...(row.outcome_order_id ? { outcomeOrderId: row.outcome_order_id } : {}),
  ...(row.outcome_recorded_at
    ? { outcomeRecordedAt: row.outcome_recorded_at }
    : {}),
  status: row.status as ConversationStatus,
  ...(row.claimed_by_staff_id
    ? { claimedByStaffId: asId<"StaffId">(row.claimed_by_staff_id) }
    : {}),
  ...(row.claimed_at ? { claimedAt: row.claimed_at } : {}),
  ...(row.buying_intent_level
    ? {
        buyingIntentLevel: row.buying_intent_level as NonNullable<
          Conversation["buyingIntentLevel"]
        >,
      }
    : {}),
  buyingIntentSignals: (row.buying_intent_signals ??
    []) as unknown as Conversation["buyingIntentSignals"],
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
  fileName: row.file_name,
  sourceKind: row.source_kind as MessageAttachment["sourceKind"],
  purpose: row.purpose as MessageAttachment["purpose"],
  ...(row.storage_bucket ? { storageBucket: row.storage_bucket } : {}),
  ...(row.storage_path ? { storagePath: row.storage_path } : {}),
  ...(row.source_url ? { sourceUrl: row.source_url } : {}),
  ...(row.mime_type
    ? { mimeType: row.mime_type as MessageAttachmentMimeType }
    : {}),
  sizeBytes: row.size_bytes,
  rightsBasis: row.rights_basis as MessageAttachment["rightsBasis"],
  scanStatus: row.scan_status as MessageAttachment["scanStatus"],
  ...(row.wedding_party_id
    ? { weddingPartyId: asId<"WeddingPartyId">(row.wedding_party_id) }
    : {}),
  ...(row.wardrobe_item_id
    ? { wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id) }
    : {}),
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

  /**
   * PHASE 10.3 (CLI-004/CMP-103): records that a conversation actually led
   * to a booked appointment or a placed order — "receives reply, books
   * appointment/creates cart and links sale" is not satisfied by message
   * history alone. `conversations` grants no authenticated write at all
   * (only the three SELECT policies above; markRead needed its own
   * security-definer RPC for the same reason) — callers must pass a
   * service-role client, and are responsible for their own role check, the
   * same boundary campaign-activation-orchestrator.ts and
   * shopify-delta-sync-orchestrator.ts already use.
   */
  async linkOutcome(args: {
    readonly conversationId: ConversationId;
    readonly retailerId: RetailerId;
    readonly outcomeAppointmentId?: string;
    readonly outcomeOrderId?: string;
  }): Promise<void> {
    if (!args.outcomeAppointmentId && !args.outcomeOrderId) {
      throw new Error(
        "linkOutcome requires at least one of outcomeAppointmentId or outcomeOrderId",
      );
    }
    const { error } = await this.client
      .from("conversations")
      .update({
        ...(args.outcomeAppointmentId
          ? { outcome_appointment_id: args.outcomeAppointmentId }
          : {}),
        ...(args.outcomeOrderId
          ? { outcome_order_id: args.outcomeOrderId }
          : {}),
        outcome_recorded_at: new Date().toISOString(),
      })
      .eq("id", args.conversationId)
      .eq("retailer_id", args.retailerId);
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
  ): Promise<{ attachment: MessageAttachment; accessUrl?: string }[]> {
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
        if (attachment.sourceKind === "link") {
          return {
            attachment,
            ...(attachment.sourceUrl
              ? { accessUrl: attachment.sourceUrl }
              : {}),
          };
        }
        if (!attachment.storageBucket || !attachment.storagePath) {
          return { attachment };
        }
        const { data: signed, error: signedError } = await this.client.storage
          .from(attachment.storageBucket)
          .createSignedUrl(attachment.storagePath, 15 * 60);
        if (signedError) throw signedError;
        return { attachment, accessUrl: signed.signedUrl };
      }),
    );
  }

  async uploadAttachment(params: {
    retailerId: RetailerId;
    conversationId: ConversationId;
    messageId: MessageId;
    purpose: Exclude<MessageAttachmentPurpose, "pinterest_link">;
    fileName: string;
    mimeType: MessageAttachmentMimeType;
    sizeBytes: number;
    content: ArrayBuffer;
    weddingPartyId?: WeddingPartyId;
    wardrobeItemId?: WardrobeItemId;
  }): Promise<MessageAttachment> {
    const storagePath = `${params.retailerId}/${params.conversationId}/${crypto.randomUUID()}-${params.fileName}`;
    const { error: uploadError } = await this.client.storage
      .from("message-attachments")
      .upload(storagePath, params.content, {
        contentType: params.mimeType,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data, error } = await this.client.rpc(
      "record_consultation_attachment",
      {
        p_message_id: params.messageId,
        p_source_kind: "upload",
        p_purpose: params.purpose,
        p_file_name: params.fileName,
        p_mime_type: params.mimeType,
        p_size_bytes: params.sizeBytes,
        p_storage_path: storagePath,
        p_wedding_party_id: (params.weddingPartyId ?? null) as never,
        p_wardrobe_item_id: (params.wardrobeItemId ?? null) as never,
      },
    );
    if (error) {
      await this.client.storage
        .from("message-attachments")
        .remove([storagePath]);
      throw error;
    }

    const { data: row, error: fetchError } = await this.client
      .from("message_attachments")
      .select("*")
      .eq("id", data)
      .single();
    if (fetchError) throw fetchError;
    return messageAttachment(row);
  }

  async recordReferenceAttachment(params: {
    conversationId: ConversationId;
    messageId: MessageId;
    purpose: "pinterest_link";
    sourceUrl: string;
    weddingPartyId?: WeddingPartyId;
  }): Promise<MessageAttachment> {
    const { data, error } = await this.client.rpc(
      "record_consultation_attachment",
      {
        p_message_id: params.messageId,
        p_source_kind: "link",
        p_purpose: params.purpose,
        p_file_name: "Pinterest reference",
        p_source_url: params.sourceUrl,
        p_wedding_party_id: (params.weddingPartyId ?? null) as never,
      },
    );
    if (error) throw error;
    const { data: row, error: fetchError } = await this.client
      .from("message_attachments")
      .select("*")
      .eq("id", data)
      .single();
    if (fetchError) throw fetchError;
    return messageAttachment(row);
  }

  /** PHASE 17.14: claim a conversation for triage. Re-derives the
   * caller's own staff row server-side via `claim_conversation`
   * (security definer) — never trusts a client-supplied staff id.
   * Returns false when someone else already claimed it first, so the
   * caller can show "already claimed" instead of silently no-op-ing. */
  async claimConversation(id: ConversationId): Promise<boolean> {
    const { data, error } = await this.client.rpc("claim_conversation", {
      p_conversation_id: id,
    });
    if (error) throw error;
    return data === true;
  }

  /** PHASE 17.14: staff-driven queue transitions (waiting_for_customer,
   * follow_up_required, converted, closed). `set_conversation_status`
   * restricts this to whoever claimed the conversation or a manager+. */
  async setConversationStatus(
    id: ConversationId,
    status: Exclude<ConversationStatus, "ai_handling">,
  ): Promise<void> {
    const { error } = await this.client.rpc("set_conversation_status", {
      p_conversation_id: id,
      p_status: status,
    });
    if (error) throw error;
  }

  /**
   * PHASE 17.14: records an explainable buying-intent classification
   * computed server-side (in the calling Server Action, from a message
   * it just validated and sent through the ordinary RPC path — never
   * from raw client input trusted at face value) and, when the
   * classification crosses this item's own escalation rule, flips a
   * still-`ai_handling` conversation to `needs_human` and notifies every
   * eligible retailer staff member the same way a fresh TableService
   * inquiry already does. Uses the admin client for the same reason as
   * `linkOutcome` — `conversations` grants no authenticated write at
   * all — so the caller is responsible for its own authorization; both
   * call sites here run inside an already-authorized message-send path.
   */
  async recordIntentClassification(args: {
    readonly conversationId: ConversationId;
    readonly retailerId: RetailerId;
    readonly classification: BuyingIntentClassification;
    readonly escalateToHuman: boolean;
  }): Promise<void> {
    const { error: signalsError } = await this.client
      .from("conversations")
      .update({
        buying_intent_level: args.classification.level,
        buying_intent_signals: args.classification.signals as unknown as never,
      })
      .eq("id", args.conversationId)
      .eq("retailer_id", args.retailerId);
    if (signalsError) throw signalsError;

    if (!args.escalateToHuman) return;

    // Only escalate a conversation still in its default AI-handled state
    // — never clobber one a human has already claimed/progressed.
    const { data: escalated, error: escalateError } = await this.client
      .from("conversations")
      .update({ status: "needs_human" })
      .eq("id", args.conversationId)
      .eq("retailer_id", args.retailerId)
      .eq("status", "ai_handling")
      .select("id")
      .maybeSingle();
    if (escalateError) throw escalateError;
    if (!escalated) return;

    const { data: eligibleStaff, error: staffError } = await this.client
      .from("retailer_staff_members")
      .select("user_id")
      .eq("retailer_id", args.retailerId)
      .in("role", ["sales_associate", "manager", "admin", "owner"])
      .not("user_id", "is", null)
      .not("accepted_at", "is", null)
      .is("deleted_at", null);
    if (staffError) throw staffError;

    const { data: customer, error: customerError } = await this.client
      .from("conversations")
      .select("customer_id")
      .eq("id", args.conversationId)
      .single();
    if (customerError) throw customerError;

    const topSignal = args.classification.signals[0];
    const summary = topSignal
      ? `High-intent enquiry: ${topSignal.label.toLowerCase()}`
      : "High-intent enquiry needs a human";

    if (eligibleStaff.length > 0) {
      const { error: notifyError } = await this.client
        .from("notifications")
        .insert(
          eligibleStaff.map((staff) => ({
            retailer_id: args.retailerId,
            recipient_user_id: staff.user_id as string,
            customer_id: customer.customer_id,
            category: "message" as const,
            title: summary,
            body: "A prospect message needs a human response.",
            action_href: `/messages?c=${args.conversationId}`,
            sent_at: new Date().toISOString(),
          })),
        );
      if (notifyError) throw notifyError;
    }
  }
}
