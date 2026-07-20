import { describe, expect, it, vi } from "vitest";

import { sendEmail } from "./send";

function fakeResend(overrides: Record<string, unknown>) {
  return overrides as never;
}

describe("sendEmail", () => {
  it("sends and returns the provider message id", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: { id: "msg_123" }, error: null });
    const resend = fakeResend({ emails: { send } });

    const result = await sendEmail(resend, {
      from: "PAON <notifications@paon.test>",
      to: "shopper@example.com",
      subject: "New message",
      html: "<p>Hello</p>",
    });

    expect(send).toHaveBeenCalledWith({
      from: "PAON <notifications@paon.test>",
      to: "shopper@example.com",
      subject: "New message",
      html: "<p>Hello</p>",
    });
    expect(result).toEqual({ providerMessageId: "msg_123" });
  });

  it("throws with the provider's error message on failure", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Invalid API key" } });
    const resend = fakeResend({ emails: { send } });

    await expect(
      sendEmail(resend, {
        from: "PAON <notifications@paon.test>",
        to: "shopper@example.com",
        subject: "New message",
        html: "<p>Hello</p>",
      }),
    ).rejects.toThrow("Invalid API key");
  });
});
