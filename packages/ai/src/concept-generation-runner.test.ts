import { describe, expect, it, vi } from "vitest";

import {
  MockConceptImageProvider,
  runConceptGenerationJob,
} from "./concept-generation-runner";
import { OpenAIProvider } from "./openai-provider";

function fakeOpenAI(data: { url?: string; revised_prompt?: string }[]) {
  const generate = vi.fn().mockResolvedValue({ data });
  return { client: { images: { generate } } as never, generate };
}

const conceptContext = {
  retailerName: "PAON Atelier",
  tenderTitle: "Autumn corporate wardrobe",
  garmentConcepts: ["Two-piece suit", "Overcoat"],
};

describe("OpenAIProvider concept images", () => {
  it("sends a built prompt and returns parsed image results", async () => {
    const { client, generate } = fakeOpenAI([
      { url: "https://example.test/a.png", revised_prompt: "revised" },
    ]);
    const provider = new OpenAIProvider(client);

    const result = await provider.generateConceptImages(conceptContext);

    expect(result.images).toEqual([
      { imageUrl: "https://example.test/a.png", revisedPrompt: "revised" },
    ]);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "dall-e-3",
        prompt: expect.stringContaining("Two-piece suit"),
      }),
    );
  });

  it("throws when no images are returned", async () => {
    const { client } = fakeOpenAI([]);
    const provider = new OpenAIProvider(client);
    await expect(
      provider.generateConceptImages(conceptContext),
    ).rejects.toThrow("no concept images");
  });

  it("throws when an image entry has no url", async () => {
    const { client } = fakeOpenAI([{ revised_prompt: "no url" }]);
    const provider = new OpenAIProvider(client);
    await expect(
      provider.generateConceptImages(conceptContext),
    ).rejects.toThrow("missing a url");
  });
});

describe("runConceptGenerationJob", () => {
  it("returns success from a mock provider", async () => {
    const provider = new MockConceptImageProvider();
    const result = await runConceptGenerationJob(provider, conceptContext);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.images).toHaveLength(1);
      expect(result.attempts).toBe(1);
      expect(result.provider).toBe("mock");
    }
  });

  it("retries transient failures then reports failure", async () => {
    const provider = new MockConceptImageProvider({
      failureMessage: "transient",
    });
    const generate = vi.spyOn(provider, "generateConceptImages");
    const result = await runConceptGenerationJob(provider, conceptContext, {
      maxAttempts: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempts).toBe(2);
      expect(result.errorMessage).toContain("transient");
    }
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
