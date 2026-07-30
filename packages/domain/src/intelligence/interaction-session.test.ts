import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import { resolveSessionContinuity, sessionIsOpen } from "./interaction-session";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const sessionId = asId<"InteractionSessionId">(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
);

describe("interaction session continuity", () => {
  it("resumes an open session inside the idle window", () => {
    const existing = {
      id: sessionId,
      retailerId,
      customerId,
      state: "active" as const,
      startedAt: "2026-07-30T10:00:00.000Z",
      lastSeenAt: "2026-07-30T11:50:00.000Z",
      deviceClass: "mobile" as const,
    };
    expect(
      sessionIsOpen({
        session: existing,
        now: "2026-07-30T12:00:00.000Z",
        idleMinutes: 30,
      }),
    ).toBe(true);
    expect(
      resolveSessionContinuity({
        retailerId,
        customerId,
        now: "2026-07-30T12:00:00.000Z",
        existing,
        deviceClass: "mobile",
      }),
    ).toEqual({
      action: "resume",
      sessionId,
      deviceClass: "mobile",
    });
  });

  it("starts a new session after idle expiry", () => {
    const existing = {
      id: sessionId,
      retailerId,
      customerId,
      state: "active" as const,
      startedAt: "2026-07-30T10:00:00.000Z",
      lastSeenAt: "2026-07-30T11:00:00.000Z",
      deviceClass: "desktop" as const,
    };
    expect(
      resolveSessionContinuity({
        retailerId,
        customerId,
        now: "2026-07-30T12:00:00.000Z",
        existing,
        idleMinutes: 30,
      }),
    ).toEqual({ action: "start", deviceClass: "unknown" });
  });
});
