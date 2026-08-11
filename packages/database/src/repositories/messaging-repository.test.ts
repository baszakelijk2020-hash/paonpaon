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
