import { describe, expect, it, vi } from "vitest";

import { OpenAIProvider } from "./openai-provider";
import {
  MockWardrobeVisualizationProvider,
  runWardrobeVisualizationJob,
} from "./wardrobe-visualization-runner";

function fakeOpenAI(data: { url?: string; revised_prompt?: string }[]) {
  const generate = vi.fn().mockResolvedValue({ data });
  return { client: { images: { generate } } as never, generate };
}

const visualizationContext = {
  retailerName: "PAON Atelier",
  referenceImageUrls: ["https://example.test/face.jpg"],
  garmentDescriptions: ["Navy two-piece suit", "White dress shirt"],
  tailoringInstructions: "Classic fit: moderate lapel, structured shoulder",
  backgroundType: "studio_neutral",
  poseFamily: "three_quarter",
  cameraHeight: "eye_level",
  cameraDistance: "medium",
  crop: "full_length",
  aspectRatio: "4:5",
  lighting: "soft_studio",
  expression: "neutral",
  visualTreatment: "editorial_quiet",
  negativeConstraints: ["no visible logos"],
};

describe("OpenAIProvider wardrobe visualization", () => {
  it("sends a built prompt and returns a parsed image result", async () => {
    const { client, generate } = fakeOpenAI([
      { url: "https://example.test/output.png", revised_prompt: "revised" },
    ]);
    const provider = new OpenAIProvider(client);

    const result =
      await provider.generateWardrobeVisualization(visualizationContext);

    expect(result).toEqual({
      imageUrl: "https://example.test/output.png",
      revisedPrompt: "revised",
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "dall-e-3",
        prompt: expect.stringContaining("Navy two-piece suit"),
      }),
    );
  });

  it("includes the identity-preservation and negative-constraint instructions", async () => {
    const { client, generate } = fakeOpenAI([
      { url: "https://example.test/output.png" },
    ]);
    const provider = new OpenAIProvider(client);

    await provider.generateWardrobeVisualization(visualizationContext);

    const prompt = generate.mock.calls[0]?.[0]?.prompt as string;
    expect(prompt).toContain(
      "Do not slim, reshape, age-reduce or change the skin tone",
    );
    expect(prompt).toContain("no visible logos");
  });

  it("throws when no image is returned", async () => {
    const { client } = fakeOpenAI([]);
    const provider = new OpenAIProvider(client);
    await expect(
      provider.generateWardrobeVisualization(visualizationContext),
    ).rejects.toThrow("missing a url");
  });
});

describe("runWardrobeVisualizationJob", () => {
  it("returns success from a mock provider", async () => {
    const provider = new MockWardrobeVisualizationProvider();
    const result = await runWardrobeVisualizationJob(
      provider,
      visualizationContext,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.imageUrl).toContain("mock-wardrobe-visualization");
      expect(result.attempts).toBe(1);
      expect(result.provider).toBe("mock");
    }
  });

  it("retries transient failures then reports failure", async () => {
    const provider = new MockWardrobeVisualizationProvider({
      failureMessage: "transient",
    });
    const generate = vi.spyOn(provider, "generateWardrobeVisualization");
    const result = await runWardrobeVisualizationJob(
      provider,
      visualizationContext,
      { maxAttempts: 2 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempts).toBe(2);
      expect(result.errorMessage).toContain("transient");
    }
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
