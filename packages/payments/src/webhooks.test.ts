import { describe, expect, it, vi } from "vitest";

import { verifyWebhookSignature } from "./webhooks";

describe("verifyWebhookSignature", () => {
  it("delegates to stripe.webhooks.constructEvent and returns the event", () => {
    const fakeEvent = { id: "evt_123", type: "checkout.session.completed" };
    const constructEvent = vi.fn().mockReturnValue(fakeEvent);
    const stripe = { webhooks: { constructEvent } } as never;

    const event = verifyWebhookSignature(
      stripe,
      "raw-payload",
      "t=1,v1=abc",
      "whsec_test",
    );

    expect(constructEvent).toHaveBeenCalledWith(
      "raw-payload",
      "t=1,v1=abc",
      "whsec_test",
    );
    expect(event).toBe(fakeEvent);
  });

  it("propagates the signature-verification error", () => {
    const constructEvent = vi.fn().mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const stripe = { webhooks: { constructEvent } } as never;

    expect(() =>
      verifyWebhookSignature(stripe, "raw-payload", "bad-sig", "whsec_test"),
    ).toThrow(/No signatures found/);
  });
});
