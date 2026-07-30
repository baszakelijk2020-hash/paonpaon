import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { MigrationJobRepository } from "./migration-job-repository";

const retailerA = asId<"RetailerId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

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

describe("MigrationJobRepository tenant scoping", () => {
  it("scopes job listing to the requested retailer", async () => {
    const from = vi.fn(() => createBuilder(() => ({ data: [], error: null })));
    const repo = new MigrationJobRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await repo.listJobs(retailerA);
    expect(from).toHaveBeenCalledWith("migration_jobs");
    const builder = from.mock.results[0]?.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.eq).toHaveBeenCalledWith("retailer_id", retailerA);
  });
});
