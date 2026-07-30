import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  DEFAULT_PRODUCT_DWELL_THRESHOLD_MS,
  DEFAULT_SESSION_HEARTBEAT_INTERVAL_MS,
  DEFAULT_SESSION_IDLE_TIMEOUT_MS,
  buildSessionContextProperties,
  idempotencyKeyFromEventProperties,
  isSessionContextEventName,
  isSessionLifecycleEventName,
  resolveSessionResume,
  sessionIdFromEventProperties,
  shouldEmitHeartbeat,
} from "./customer-session";

describe("customer interaction session domain", () => {
  it("resumes within the idle window and starts fresh after expiry", () => {
    const sessionId = asId<"CustomerInteractionSessionId">(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    const now = "2026-07-30T12:00:00.000Z";
    const recent = "2026-07-30T11:45:00.000Z";
    const stale = "2026-07-30T10:00:00.000Z";

    expect(
      resolveSessionResume({
        resumeSessionId: sessionId,
        lastHeartbeatAt: recent,
        now,
      }),
    ).toBe(sessionId);

    expect(
      resolveSessionResume({
        resumeSessionId: sessionId,
        lastHeartbeatAt: stale,
        now,
        idleTimeoutMs: DEFAULT_SESSION_IDLE_TIMEOUT_MS,
      }),
    ).toBeNull();
  });

  it("builds session context properties with idempotency and route", () => {
    const sessionId = asId<"CustomerInteractionSessionId">(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    const properties = buildSessionContextProperties({
      sessionId,
      route: "/r/demo/tie-mate",
      idempotencyKey: "key-1",
      context: { productId: "prod-1" },
    });
    expect(properties).toMatchObject({
      sessionId,
      route: "/r/demo/tie-mate",
      idempotencyKey: "key-1",
      productId: "prod-1",
    });
    expect(sessionIdFromEventProperties(properties)).toBe(sessionId);
    expect(idempotencyKeyFromEventProperties(properties)).toBe("key-1");
  });

  it("recognizes lifecycle and context event names", () => {
    expect(isSessionLifecycleEventName("session_started")).toBe(true);
    expect(isSessionContextEventName("tie_mate_impression")).toBe(true);
    expect(isSessionLifecycleEventName("product_viewed")).toBe(false);
  });

  it("gates heartbeat emission by interval", () => {
    expect(
      shouldEmitHeartbeat({
        lastHeartbeatAt: "2026-07-30T12:00:00.000Z",
        now: "2026-07-30T12:00:30.000Z",
      }),
    ).toBe(false);
    expect(
      shouldEmitHeartbeat({
        lastHeartbeatAt: "2026-07-30T12:00:00.000Z",
        now: "2026-07-30T12:01:05.000Z",
        intervalMs: DEFAULT_SESSION_HEARTBEAT_INTERVAL_MS,
      }),
    ).toBe(true);
  });

  it("uses a 3s product dwell threshold default", () => {
    expect(DEFAULT_PRODUCT_DWELL_THRESHOLD_MS).toBe(3000);
  });
});
