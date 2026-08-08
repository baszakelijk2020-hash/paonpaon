/**
 * PHASE 17.14: AI-proposed conversation reply drafts. Human-in-the-loop by
 * construction, same discipline as `AdvisorCaptureRepository` — a draft is
 * a *proposal* against the same approved knowledge/product allowlist
 * TableService guidance already enforces, and it never reaches the
 * customer as a real `messages` row until a staff member sends it as-is
 * or edited through `approveAndSend`, which always goes through the
 * ordinary `send_conversation_message` RPC so the real message keeps its
 * true sender.
 */

import {
  asId,
  type ConversationId,
  type MessageAiDraft,
  type MessageId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type DraftRow = Database["public"]["Tables"]["message_ai_drafts"]["Row"];

function toDomain(row: DraftRow): MessageAiDraft {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    conversationId: asId<"ConversationId">(row.conversation_id),
    ...(row.based_on_message_id
      ? { basedOnMessageId: asId<"MessageId">(row.based_on_message_id) }
      : {}),
    draftText: row.draft_text,
    knowledgeObjectIds: (row.knowledge_object_ids ?? []) as string[],
    productIds: (row.product_ids ?? []) as string[],
    status: row.status as MessageAiDraft["status"],
    ...(row.resolved_by_staff_id
      ? { resolvedByStaffId: asId<"StaffId">(row.resolved_by_staff_id) }
      : {}),
    ...(row.resolved_at ? { resolvedAt: row.resolved_at } : {}),
    ...(row.sent_message_id
      ? { sentMessageId: asId<"MessageId">(row.sent_message_id) }
      : {}),
    createdAt: row.created_at,
  };
}

export class ConversationDraftRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async propose(args: {
    readonly retailerId: RetailerId;
    readonly conversationId: ConversationId;
    readonly basedOnMessageId?: MessageId;
    readonly draftText: string;
    readonly knowledgeObjectIds: readonly string[];
    readonly productIds: readonly string[];
  }): Promise<MessageAiDraft> {
    const { data, error } = await this.client
      .from("message_ai_drafts")
      .insert({
        retailer_id: args.retailerId,
        conversation_id: args.conversationId,
        based_on_message_id: args.basedOnMessageId ?? null,
        draft_text: args.draftText.trim().slice(0, 5000),
        knowledge_object_ids: [...args.knowledgeObjectIds] as Json,
        product_ids: [...args.productIds] as Json,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }

  async findLatestProposedForConversation(
    conversationId: ConversationId,
  ): Promise<MessageAiDraft | null> {
    const { data, error } = await this.client
      .from("message_ai_drafts")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("status", "proposed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async dismiss(draftId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc(
      "dismiss_conversation_ai_draft",
      { p_draft_id: draftId },
    );
    if (error) throw error;
    return data;
  }

  /**
   * Sends the draft as a real message — as-is, or edited — and links the
   * resulting message back to this draft row. Always goes through
   * `approve_conversation_ai_draft`, which invokes the ordinary
   * `send_conversation_message` function inside the same transaction.
   */
  async approveAndSend(args: {
    readonly draftId: string;
    readonly editedText?: string;
  }): Promise<MessageId> {
    const { data, error } = await this.client.rpc(
      "approve_conversation_ai_draft",
      {
        p_draft_id: args.draftId,
        ...(args.editedText !== undefined
          ? { p_edited_text: args.editedText }
          : {}),
      },
    );
    if (error) throw error;
    return asId<"MessageId">(data);
  }
}
