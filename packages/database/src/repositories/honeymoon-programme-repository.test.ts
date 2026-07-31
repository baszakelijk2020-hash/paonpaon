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
});
