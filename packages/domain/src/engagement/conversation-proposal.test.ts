import { describe, expect, it } from "vitest";

import { isConversationProposalRespondable } from "./conversation-proposal";

describe("isConversationProposalRespondable", () => {
  it("is respondable while active and before expiry", () => {
    expect(
      isConversationProposalRespondable(
        { status: "active", expiresAt: "2026-08-20T00:00:00.000Z" },
        "2026-08-15T00:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("treats the exact expiry instant as still respondable", () => {
    expect(
      isConversationProposalRespondable(
        { status: "active", expiresAt: "2026-08-20T00:00:00.000Z" },
        "2026-08-20T00:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("is not respondable once past expiry, even while status still says active", () => {
    // Mirrors the RPC: status can lag reality between polling refreshes,
    // so the time check must never be skipped just because status="active".
    expect(
      isConversationProposalRespondable(
        { status: "active", expiresAt: "2026-08-10T00:00:00.000Z" },
        "2026-08-15T00:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("is not respondable once superseded, regardless of expiry", () => {
    expect(
      isConversationProposalRespondable(
        { status: "superseded", expiresAt: "2026-08-30T00:00:00.000Z" },
        "2026-08-15T00:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("is not respondable once already accepted", () => {
    expect(
      isConversationProposalRespondable(
        { status: "accepted", expiresAt: "2026-08-30T00:00:00.000Z" },
        "2026-08-15T00:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("is not respondable once already declined", () => {
    expect(
      isConversationProposalRespondable(
        { status: "declined", expiresAt: "2026-08-30T00:00:00.000Z" },
        "2026-08-15T00:00:00.000Z",
      ),
    ).toBe(false);
  });
});
