import { describe, expect, it } from "vitest";

import { parseStripePlatformEvent } from "./platform-webhook-events";

function fakeEvent(type: string, object: unknown): never {
  return { id: "evt_123", type, data: { object } } as never;
}

describe("parseStripePlatformEvent", () => {
  it("maps customer.subscription.updated to a sync_subscription action", () => {
    const action = parseStripePlatformEvent(
      fakeEvent("customer.subscription.updated", {
        id: "sub_123",
        status: "active",
        cancel_at_period_end: false,
        trial_end: null,
        items: {
          data: [
            {
              current_period_start: 1735689600,
              current_period_end: 1738368000,
            },
          ],
        },
      }),
    );
    expect(action).toEqual({
      kind: "sync_subscription",
      providerSubscriptionId: "sub_123",
      status: "active",
      currentPeriodStart: new Date(1735689600 * 1000).toISOString(),
      currentPeriodEnd: new Date(1738368000 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
    });
  });

  it("maps customer.subscription.deleted to a sync_subscription action with canceled status", () => {
    const action = parseStripePlatformEvent(
      fakeEvent("customer.subscription.deleted", {
        id: "sub_124",
        status: "canceled",
        cancel_at_period_end: false,
        trial_end: null,
        items: { data: [] },
      }),
    );
    expect(action).toMatchObject({
      kind: "sync_subscription",
      status: "canceled",
    });
  });

  it("ignores an unrecognized event type", () => {
    const action = parseStripePlatformEvent(
      fakeEvent("invoice.paid", { id: "in_123" }),
    );
    expect(action).toEqual({ kind: "ignored" });
  });
});
