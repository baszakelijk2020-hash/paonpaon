import { describe, expect, it } from "vitest";

import {
  sendMessageSchema,
  startCustomerConversationSchema,
} from "./messaging.schema";

describe("messaging schemas", () => {
  it("accepts a customer opening message", () => {
    expect(
      startCustomerConversationSchema.safeParse({
        retailerId: "11111111-1111-1111-1111-111111111111",
        body: "May I arrange a fitting?",
      }).success,
    ).toBe(true);
  });
  it("rejects empty messages", () => {
    expect(
      sendMessageSchema.safeParse({
        conversationId: "11111111-1111-1111-1111-111111111111",
        body: "  ",
      }).success,
    ).toBe(false);
  });
});
