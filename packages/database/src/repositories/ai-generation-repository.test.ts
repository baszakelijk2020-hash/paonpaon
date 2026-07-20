import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { AIGenerationRepository } from "./ai-generation-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type AIGenerationRow = Database["public"]["Tables"]["ai_generations"]["Row"];

const generationRow: AIGenerationRow = {
  id: "11111111-1111-1111-1111-111111111111",
  retailer_id: "22222222-2222-2222-2222-222222222222",
  customer_id: "33333333-3333-3333-3333-333333333333",
  requested_by_staff_id: "44444444-4444-4444-4444-444444444444",
  kind: "next_best_action",
  status: "succeeded",
  provider: "openai",
  model: "gpt-4o-mini",
  input_summary: "customer=Jane Shopper events=2 orders=1",
  output: {
    action: "Call to follow up",
    rationale: "Recently viewed a product.",
  },
  error_message: null,
  latency_ms: 842,
  created_at: "2026-01-01T00:00:00.000Z",
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("AIGenerationRepository", () => {
  it("record inserts and returns the mapped domain object", async () => {
    const repo = new AIGenerationRepository(
      clientReturning({ data: generationRow, error: null }),
    );
    const generation = await repo.record({
      retailerId: generationRow.retailer_id as never,
      customerId: generationRow.customer_id as never,
      kind: "next_best_action",
      status: "succeeded",
      provider: "openai",
      model: "gpt-4o-mini",
      inputSummary: "customer=Jane Shopper events=2 orders=1",
      output: {
        action: "Call to follow up",
        rationale: "Recently viewed a product.",
      },
      latencyMs: 842,
    });
    expect(generation.status).toBe("succeeded");
    expect(generation.output).toEqual({
      action: "Call to follow up",
      rationale: "Recently viewed a product.",
    });
    expect(generation.latencyMs).toBe(842);
  });

  it("maps a failed row without output", async () => {
    const failedRow: AIGenerationRow = {
      ...generationRow,
      status: "failed",
      output: null,
      error_message: "OpenAI returned no content",
    };
    const repo = new AIGenerationRepository(
      clientReturning({ data: failedRow, error: null }),
    );
    const generation = await repo.record({
      retailerId: generationRow.retailer_id as never,
      kind: "next_best_action",
      status: "failed",
      provider: "openai",
      model: "gpt-4o-mini",
      inputSummary: "customer=Jane Shopper events=0 orders=0",
      errorMessage: "OpenAI returned no content",
    });
    expect(generation.status).toBe("failed");
    expect(generation.output).toBeUndefined();
    expect(generation.errorMessage).toBe("OpenAI returned no content");
  });

  it("findByCustomer maps rows in descending order", async () => {
    const repo = new AIGenerationRepository(
      clientReturning({ data: [generationRow], error: null }),
    );
    const generations = await repo.findByCustomer(
      generationRow.customer_id as never,
    );
    expect(generations).toHaveLength(1);
    expect(generations[0]?.id).toBe(generationRow.id);
  });

  it("findRecent maps rows for platform monitoring", async () => {
    const repo = new AIGenerationRepository(
      clientReturning({ data: [generationRow], error: null }),
    );
    const generations = await repo.findRecent();
    expect(generations).toHaveLength(1);
  });
});
