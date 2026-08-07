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
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

import { MessagingRepository } from "./messaging-repository";

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

export type ResolveDraftResult =
  | { readonly ok: true; readonly draft: MessageAiDraft }
  | { readonly ok: false; readonly reason: "not_found" | "already_resolved" };

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

  private async loadProposedDraft(
    retailerId: RetailerId,
    draftId: string,
  ): Promise<DraftRow | null> {
    const { data, error } = await this.client
      .from("message_ai_drafts")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("id", draftId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async dismiss(args: {
    readonly retailerId: RetailerId;
    readonly draftId: string;
    readonly staffId: StaffId;
  }): Promise<ResolveDraftResult> {
    const existing = await this.loadProposedDraft(
      args.retailerId,
      args.draftId,
    );
    if (!existing) return { ok: false, reason: "not_found" };
    if (existing.status !== "proposed") {
      return { ok: false, reason: "already_resolved" };
    }
    const { data, error } = await this.client
      .from("message_ai_drafts")
      .update({
        status: "dismissed",
        resolved_by_staff_id: args.staffId,
        resolved_at: new Date().toISOString(),
      })
      .eq("retailer_id", args.retailerId)
      .eq("id", args.draftId)
      .eq("status", "proposed")
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, draft: toDomain(data) };
  }

  /**
   * Sends the draft as a real message — as-is, or edited — and links the
   * resulting message back to this draft row. Always goes through
   * `MessagingRepository.send` (the ordinary `send_conversation_message`
   * RPC), so the sent message's own `sender_type`/`sender_staff_id` are
   * exactly as true as any other staff-sent message; this row is the
   * only place the AI origin is recorded.
   */
  async approveAndSend(args: {
    readonly retailerId: RetailerId;
    readonly conversationId: ConversationId;
    readonly draftId: string;
    readonly staffId: StaffId;
    readonly editedText?: string;
  }): Promise<
    | { readonly ok: true; readonly messageId: MessageId }
    | { readonly ok: false; readonly reason: "not_found" | "already_resolved" }
  > {
    const existing = await this.loadProposedDraft(
      args.retailerId,
      args.draftId,
    );
    if (!existing) return { ok: false, reason: "not_found" };
    if (existing.status !== "proposed") {
      return { ok: false, reason: "already_resolved" };
    }

    const edited =
      args.editedText !== undefined &&
      args.editedText.trim() !== existing.draft_text.trim();
    const finalText = (args.editedText ?? existing.draft_text).trim();

    const messageId = await new MessagingRepository(this.client).send(
      args.conversationId,
      finalText,
    );

    const { error } = await this.client
      .from("message_ai_drafts")
      .update({
        status: edited ? "edited_and_sent" : "sent",
        resolved_by_staff_id: args.staffId,
        resolved_at: new Date().toISOString(),
        sent_message_id: messageId,
      })
      .eq("retailer_id", args.retailerId)
      .eq("id", args.draftId)
      .eq("status", "proposed");
    if (error) throw error;

    return { ok: true, messageId };
  }
}
