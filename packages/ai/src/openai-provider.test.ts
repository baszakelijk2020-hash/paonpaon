import { describe, expect, it, vi } from "vitest";

import { OpenAIProvider } from "./openai-provider";

function fakeOpenAI(content: string | null) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  });
  return { client: { chat: { completions: { create } } } as never, create };
}

const context = {
  retailerName: "Maison Test",
  customerName: "Jane Shopper",
  lifecycleStage: "returning",
  recentEventNames: ["viewed_product", "added_to_wishlist"],
  recentOrderSummaries: ["ORD-000001: $4,500.00 delivered"],
};

describe("OpenAIProvider", () => {
  it("uses gpt-4o-mini by default and reports its provider name", () => {
    const { client } = fakeOpenAI("{}");
    const provider = new OpenAIProvider(client);
    expect(provider.model).toBe("gpt-4o-mini");
    expect(provider.providerName).toBe("openai");
  });

  it("sends a JSON-mode chat completion with the built context prompt", async () => {
    const { client, create } = fakeOpenAI(
      JSON.stringify({
        action: "Call to follow up",
        rationale: "Recently viewed a product.",
      }),
    );
    const provider = new OpenAIProvider(client, "gpt-4o-mini");

    await provider.generateNextBestAction(context);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Jane Shopper"),
          }),
        ]),
      }),
    );
  });

  it("parses a valid JSON action/rationale response", async () => {
    const { client } = fakeOpenAI(
      JSON.stringify({
        action: "Call to follow up",
        rationale: "Recently viewed a product.",
      }),
    );
    const provider = new OpenAIProvider(client);

    const result = await provider.generateNextBestAction(context);

    expect(result).toEqual({
      action: "Call to follow up",
      rationale: "Recently viewed a product.",
    });
  });

  it("throws when OpenAI returns no content", async () => {
    const { client } = fakeOpenAI(null);
    const provider = new OpenAIProvider(client);

    await expect(provider.generateNextBestAction(context)).rejects.toThrow(
      "no content",
    );
  });

  it("throws when the response is not valid JSON", async () => {
    const { client } = fakeOpenAI("not json");
    const provider = new OpenAIProvider(client);

    await expect(provider.generateNextBestAction(context)).rejects.toThrow(
      "not valid JSON",
    );
  });

  it("throws when the response is missing action or rationale", async () => {
    const { client } = fakeOpenAI(JSON.stringify({ action: "Call" }));
    const provider = new OpenAIProvider(client);

    await expect(provider.generateNextBestAction(context)).rejects.toThrow(
      "missing action/rationale",
    );
  });

  const recommendationContext = {
    retailerName: "Maison Test",
    customerName: "Jane Shopper",
    recentEventNames: ["product_viewed", "category_browsed"],
    candidates: [
      { productId: "p1", name: "Wool Overcoat", description: "Camel wool" },
      { productId: "p2", name: "Silk Tie", description: "Navy silk" },
    ],
  };

  it("parses a valid productId/rationale recommendation", async () => {
    const { client } = fakeOpenAI(
      JSON.stringify({ productId: "p1", rationale: "Matches your browsing." }),
    );
    const provider = new OpenAIProvider(client);

    const result = await provider.generateProductRecommendation(
      recommendationContext,
    );

    expect(result).toEqual({
      productId: "p1",
      rationale: "Matches your browsing.",
    });
  });

  it("rejects a recommendation outside the candidate list", async () => {
    const { client } = fakeOpenAI(
      JSON.stringify({ productId: "not-a-candidate", rationale: "Nice." }),
    );
    const provider = new OpenAIProvider(client);

    await expect(
      provider.generateProductRecommendation(recommendationContext),
    ).rejects.toThrow("outside the candidate list");
  });

  it("throws when the recommendation response is missing productId or rationale", async () => {
    const { client } = fakeOpenAI(JSON.stringify({ productId: "p1" }));
    const provider = new OpenAIProvider(client);

    await expect(
      provider.generateProductRecommendation(recommendationContext),
    ).rejects.toThrow("missing productId/rationale");
  });
});
