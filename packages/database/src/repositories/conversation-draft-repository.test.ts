import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { ConversationDraftRepository } from "./conversation-draft-repository";

const draftId = "33333333-3333-4333-8333-333333333333";
const messageId = asId<"MessageId">("55555555-5555-4555-8555-555555555555");

describe("ConversationDraftRepository resolution", () => {
  it("dismisses only through the caller-deriving RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const repository = new ConversationDraftRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await expect(repository.dismiss(draftId)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("dismiss_conversation_ai_draft", {
      p_draft_id: draftId,
    });
  });

  it("approves and sends atomically through one RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: messageId, error: null });
    const repository = new ConversationDraftRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.approveAndSend({
        draftId,
        editedText: "Advisor-reviewed reply",
      }),
    ).resolves.toBe(messageId);
    expect(rpc).toHaveBeenCalledWith("approve_conversation_ai_draft", {
      p_draft_id: draftId,
      p_edited_text: "Advisor-reviewed reply",
    });
  });

  it("omits the optional edit when sending the proposed wording as-is", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: messageId, error: null });
    const repository = new ConversationDraftRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await repository.approveAndSend({ draftId });
    expect(rpc).toHaveBeenCalledWith("approve_conversation_ai_draft", {
      p_draft_id: draftId,
    });
  });
});
