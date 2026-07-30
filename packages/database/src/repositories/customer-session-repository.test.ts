import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { CustomerSessionRepository } from "./customer-session-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

describe("CustomerSessionRepository", () => {
  it("starts a session via RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      error: null,
    });
    const repository = new CustomerSessionRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.start({
        retailerId: "11111111-1111-1111-1111-111111111111" as never,
        route: "/r/demo/tie-mate",
      }),
    ).resolves.toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    expect(rpc).toHaveBeenCalledWith(
      "start_customer_interaction_session",
      expect.objectContaining({
        p_route: "/r/demo/tie-mate",
      }),
    );
  });

  it("maps session rows to domain", async () => {
    const client = {
      from: () =>
        fakeQueryBuilder({
          data: {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            retailer_id: "11111111-1111-1111-1111-111111111111",
            customer_id: "44444444-4444-4444-4444-444444444444",
            route: "/r/demo/tie-mate",
            visibility_state: "visible",
            started_at: "2026-07-30T12:00:00.000Z",
            last_heartbeat_at: "2026-07-30T12:01:00.000Z",
            ended_at: null,
            idle_since: null,
            created_at: "2026-07-30T12:00:00.000Z",
          },
          error: null,
        }),
    } as unknown as PaonSupabaseClient;

    const session = await new CustomerSessionRepository(client).findById(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as never,
    );
    expect(session).toMatchObject({
      route: "/r/demo/tie-mate",
      visibilityState: "visible",
    });
  });
});
