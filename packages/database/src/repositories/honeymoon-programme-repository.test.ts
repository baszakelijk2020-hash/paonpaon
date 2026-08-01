import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { HoneymoonProgrammeRepository } from "./honeymoon-programme-repository";

const retailerId = asId<"RetailerId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

type QueryResult = { data: unknown; error: null | { message: string } };

function createBuilder(resolve: () => QueryResult) {
  const builder: Record<string, unknown> = {};
  const self = new Proxy(builder, {
    get(target, prop) {
      if (prop === "then") {
        return (onFulfilled: (value: QueryResult) => unknown) =>
          Promise.resolve(resolve()).then(onFulfilled);
      }
      if (!(prop in target)) {
        target[prop as string] = vi.fn(() => self);
      }
      return target[prop as string];
    },
  });
  return self as { eq: ReturnType<typeof vi.fn> };
}

describe("HoneymoonProgrammeRepository", () => {
  it("scopes programme lookup by retailer and order", async () => {
    const from = vi.fn(() =>
      createBuilder(() => ({ data: null, error: null })),
    );
    const repo = new HoneymoonProgrammeRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await repo.findByOrder(retailerId, "order-1");
    expect(from).toHaveBeenCalledWith("honeymoon_programmes");
    const builder = from.mock.results[0]?.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.eq).toHaveBeenCalledWith("retailer_id", retailerId);
    expect(builder.eq).toHaveBeenCalledWith("order_id", "order-1");
  });

  it("returns the programme projection without a fragile post-write lookup", async () => {
    let programmeQueries = 0;
    const from = vi.fn((table: string) => {
      if (table === "honeymoon_programmes") {
        programmeQueries += 1;
        if (programmeQueries === 1) {
          return createBuilder(() => ({ data: null, error: null }));
        }
        return createBuilder(() => ({
          data: {
            id: "programme-1",
            retailer_id: retailerId,
            customer_id: "customer-1",
            order_id: "order-1",
            status: "active",
          },
          error: null,
        }));
      }
      return createBuilder(() => ({ data: null, error: null }));
    });
    const repo = new HoneymoonProgrammeRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const result = await repo.ensureForOrder({
      retailerId,
      customerId: "customer-1",
      orderId: "order-1",
      orderStatus: "pending_payment",
      contactPressureActive: false,
      lines: [
        {
          productLabel: "Jacket",
          quantity: 1,
          inStock: true,
          leadTimeDays: 0,
        },
      ],
    });

    expect(result.id).toBe("programme-1");
    expect(result.actions).toHaveLength(3);
    expect(programmeQueries).toBe(2);
  });
});
