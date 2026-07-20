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
});
