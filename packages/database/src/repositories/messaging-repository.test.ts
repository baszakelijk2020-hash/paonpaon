import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { MessagingRepository } from "./messaging-repository";

const retailerId = asId<"RetailerId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const conversationId = asId<"ConversationId">(
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
);

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
