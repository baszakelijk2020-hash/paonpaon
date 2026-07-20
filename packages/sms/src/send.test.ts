import { describe, expect, it, vi } from "vitest";

import { sendText } from "./send";

function fakeTwilio(overrides: Record<string, unknown>) {
  return overrides as never;
}

describe("sendText", () => {
  it("sends a plain SMS and returns the provider message id", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ sid: "SM123", errorMessage: null });
    const client = fakeTwilio({ messages: { create } });

    const result = await sendText(client, {
      channel: "sms",
      from: "+15551234567",
      to: "+15557654321",
      body: "Your alteration is ready",
    });

    expect(create).toHaveBeenCalledWith({
      from: "+15551234567",
      to: "+15557654321",
      body: "Your alteration is ready",
    });
    expect(result).toEqual({ providerMessageId: "SM123" });
  });

  it("prefixes from/to with whatsapp: for the whatsapp channel", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ sid: "SM456", errorMessage: null });
    const client = fakeTwilio({ messages: { create } });

    await sendText(client, {
      channel: "whatsapp",
      from: "+15551234567",
      to: "+15557654321",
      body: "Your alteration is ready",
    });

    expect(create).toHaveBeenCalledWith({
      from: "whatsapp:+15551234567",
      to: "whatsapp:+15557654321",
      body: "Your alteration is ready",
    });
  });

  it("throws with the provider's error message on failure", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ sid: "SM789", errorMessage: "Invalid number" });
    const client = fakeTwilio({ messages: { create } });

    await expect(
      sendText(client, {
        channel: "sms",
        from: "+15551234567",
        to: "invalid",
        body: "Hello",
      }),
    ).rejects.toThrow("Invalid number");
  });
});
