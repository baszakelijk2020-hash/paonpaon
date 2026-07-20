import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { EmailOutboxRepository } from "./email-outbox-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type EmailOutboxRow = Database["public"]["Tables"]["email_outbox"]["Row"];

const outboxRow: EmailOutboxRow = {
  id: "11111111-1111-1111-1111-111111111111",
  notification_id: "22222222-2222-2222-2222-222222222222",
  recipient_email: "shopper@example.com",
  subject: "New message",
  html_body: "<p>Hello</p>",
  status: "sending",
  attempts: 0,
  last_error: null,
  sent_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("EmailOutboxRepository", () => {
  it("claimPending calls the protected RPC and maps rows to domain objects", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [outboxRow], error: null });
    const repo = new EmailOutboxRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    const claimed = await repo.claimPending(10);

    expect(rpc).toHaveBeenCalledWith("claim_pending_emails", { p_limit: 10 });
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.recipientEmail).toBe("shopper@example.com");
    expect(claimed[0]?.status).toBe("sending");
  });

  it("claimPending defaults to a limit of 20", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const repo = new EmailOutboxRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await repo.claimPending();

    expect(rpc).toHaveBeenCalledWith("claim_pending_emails", { p_limit: 20 });
  });

  it("markSent throws on a repository error", async () => {
    const repo = new EmailOutboxRepository(
      clientReturning({ data: null, error: new Error("boom") }),
    );
    await expect(repo.markSent(outboxRow.id)).rejects.toThrow("boom");
  });

  it("markFailed reverts to pending under MAX_ATTEMPTS", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const repo = new EmailOutboxRepository({
      from: () => ({ update }),
    } as unknown as PaonSupabaseClient);

    await repo.markFailed(outboxRow.id, 2, "SMTP timeout");

    expect(update).toHaveBeenCalledWith({
      status: "pending",
      attempts: 3,
      last_error: "SMTP timeout",
    });
  });

  it("markFailed permanently fails at MAX_ATTEMPTS", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const repo = new EmailOutboxRepository({
      from: () => ({ update }),
    } as unknown as PaonSupabaseClient);

    await repo.markFailed(outboxRow.id, 4, "Invalid recipient");

    expect(update).toHaveBeenCalledWith({
      status: "failed",
      attempts: 5,
      last_error: "Invalid recipient",
    });
  });
});
