import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { MessagingRepository } from "./messaging-repository";

const retailerId = asId<"RetailerId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const conversationId = asId<"ConversationId">(
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
);
const messageId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function createBuilder(onUpdate?: (payload: Record<string, unknown>) => void) {
  const builder: Record<string, unknown> = {};
  const self = new Proxy(builder, {
    get(target, prop) {
      if (prop === "then") {
        return (onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(onFulfilled);
      }
      if (prop === "update") {
        return vi.fn((payload: Record<string, unknown>) => {
          onUpdate?.(payload);
          return self;
        });
      }
      if (!(prop in target)) {
        target[prop as string] = vi.fn(() => self);
      }
      return target[prop as string];
    },
  });
  return self;
}

describe("MessagingRepository.linkOutcome", () => {
  it("rejects a call naming neither an appointment nor an order", async () => {
    const from = vi.fn();
    const repo = new MessagingRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await expect(
      repo.linkOutcome({ conversationId, retailerId }),
    ).rejects.toThrow(/requires at least one of/);
    expect(from).not.toHaveBeenCalled();
  });

  it("scopes the update to the conversation and retailer", async () => {
    let updatePayload: Record<string, unknown> | undefined;
    const from = vi.fn((table: string) => {
      if (table !== "conversations") throw new Error(`unexpected ${table}`);
      return createBuilder((payload) => {
        updatePayload = payload;
      });
    });
    const repo = new MessagingRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await repo.linkOutcome({
      conversationId,
      retailerId,
      outcomeOrderId: "order-1",
    });

    expect(from).toHaveBeenCalledWith("conversations");
    expect(updatePayload).toMatchObject({ outcome_order_id: "order-1" });
    expect(updatePayload?.outcome_recorded_at).toEqual(expect.any(String));
  });
});

describe("MessagingRepository conversation proposals", () => {
  it("createProposal calls the RPC with the exact args the schema expects", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      error: null,
    });
    const repo = new MessagingRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    const id = await repo.createProposal({
      conversationId,
      title: "Look for Saturday",
      advisorNote: "Navy two-piece per your last visit.",
      items: [{ label: "Navy two-piece suit" }],
      alternatives: [],
      appointmentOffered: true,
      expiresAt: "2026-08-20T00:00:00.000Z",
    });

    expect(rpc).toHaveBeenCalledWith("create_conversation_proposal", {
      p_conversation_id: conversationId,
      p_title: "Look for Saturday",
      p_advisor_note: "Navy two-piece per your last visit.",
      p_items: [{ label: "Navy two-piece suit" }],
      p_alternatives: [],
      p_appointment_offered: true,
      p_expires_at: "2026-08-20T00:00:00.000Z",
    });
    expect(id).toBe("ffffffff-ffff-4fff-8fff-ffffffffffff");
  });

  it("respondToProposal calls the RPC with the proposal id and response", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const repo = new MessagingRepository({
      rpc,
    } as unknown as PaonSupabaseClient);
    const proposalId = asId<"ConversationProposalId">(
      "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa",
    );

    await repo.respondToProposal(proposalId, "accepted");

    expect(rpc).toHaveBeenCalledWith("respond_to_conversation_proposal", {
      p_proposal_id: proposalId,
      p_response: "accepted",
    });
  });

  it("respondToProposal surfaces the RPC's stale-proposal rejection", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: { message: "This proposal has expired" },
    });
    const repo = new MessagingRepository({
      rpc,
    } as unknown as PaonSupabaseClient);
    const proposalId = asId<"ConversationProposalId">(
      "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa",
    );

    await expect(
      repo.respondToProposal(proposalId, "accepted"),
    ).rejects.toMatchObject({ message: "This proposal has expired" });
  });

  it("findProposalsByConversation orders newest version first", async () => {
    const rows = [
      {
        id: "p1",
        retailer_id: retailerId,
        conversation_id: conversationId,
        created_by_staff_id: "staff-1",
        version: 2,
        status: "active",
        title: "Revised look",
        advisor_note: "Swapped to charcoal.",
        items: [{ label: "Charcoal suit" }],
        alternatives: [],
        price_minor_units: null,
        price_currency: null,
        appointment_offered: false,
        expires_at: "2026-08-22T00:00:00.000Z",
        responded_at: null,
        response: null,
        created_at: "2026-08-15T00:00:00.000Z",
        updated_at: "2026-08-15T00:00:00.000Z",
      },
    ];
    const query = (data: unknown) => {
      const chain: Record<string, unknown> = {};
      const proxy = new Proxy(chain, {
        get(target, prop) {
          if (prop === "then") {
            return (resolve: (value: unknown) => unknown) =>
              Promise.resolve({ data, error: null }).then(resolve);
          }
          if (!(prop in target)) target[prop as string] = vi.fn(() => proxy);
          return target[prop as string];
        },
      });
      return proxy;
    };
    const repo = new MessagingRepository({
      from: vi.fn(() => query(rows)),
    } as unknown as PaonSupabaseClient);

    const proposals = await repo.findProposalsByConversation(conversationId);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      version: 2,
      status: "active",
      title: "Revised look",
    });
  });
});

describe("MessagingRepository attachment quarantine", () => {
  it("does not mint a signed URL until an upload is explicitly cleared", async () => {
    const query = (data: unknown) => {
      const chain: Record<string, unknown> = {};
      const proxy = new Proxy(chain, {
        get(target, prop) {
          if (prop === "then") {
            return (resolve: (value: unknown) => unknown) =>
              Promise.resolve({ data, error: null }).then(resolve);
          }
          if (!(prop in target)) target[prop as string] = vi.fn(() => proxy);
          return target[prop as string];
        },
      });
      return proxy;
    };
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.example/file" },
      error: null,
    });
    const attachmentRows = ["pending_scan", "cleared"].map((scan_status) => ({
      id: `${scan_status}-attachment`,
      retailer_id: retailerId,
      message_id: messageId,
      file_name: `${scan_status}.jpg`,
      source_kind: "upload",
      purpose: "photo",
      storage_bucket: "message-attachments",
      storage_path: `house/${scan_status}.jpg`,
      source_url: null,
      mime_type: "image/jpeg",
      size_bytes: 12,
      rights_basis: "customer_consultation",
      scan_status,
      wedding_party_id: null,
      wardrobe_item_id: null,
      uploaded_by_staff_id: null,
      uploaded_by_user_id: "user-1",
      created_at: "2026-08-12T00:00:00.000Z",
    }));
    const repo = new MessagingRepository({
      from: vi.fn((table: string) =>
        query(table === "messages" ? [{ id: messageId }] : attachmentRows),
      ),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    } as unknown as PaonSupabaseClient);

    const rows = await repo.findAttachmentsByConversation(conversationId);

    expect(rows[0]?.accessUrl).toBeUndefined();
    expect(rows[1]?.accessUrl).toBe("https://signed.example/file");
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("retries through the narrow scan RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const repo = new MessagingRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await repo.retryAttachmentScan(
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" as never,
    );

    expect(rpc).toHaveBeenCalledWith("retry_message_attachment_scan", {
      p_attachment_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });
  });
});
