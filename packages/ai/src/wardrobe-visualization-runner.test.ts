import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAIProvider } from "./openai-provider";
import {
  MockWardrobeVisualizationProvider,
  runWardrobeVisualizationJob,
} from "./wardrobe-visualization-runner";

type OpenAIWardrobeEditImage = {
  b64_json?: string;
  revised_prompt?: string;
};

type ReferenceFixture = {
  bytes: Uint8Array;
  contentType: string;
};

type WardrobeEditRequest = {
  model: string;
  prompt: string;
  n: number;
  size: string;
  output_format: string;
  image: Array<{
    name: string;
    type: string;
    size: number;
    arrayBuffer: () => Promise<ArrayBuffer>;
  }>;
};

function fakeOpenAI(data: OpenAIWardrobeEditImage[]) {
  const edit = vi.fn().mockResolvedValue({ data });
  return { client: { images: { edit } } as never, edit };
}

function mockReferenceFetch(fixtures: Record<string, ReferenceFixture>) {
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    const fixture = fixtures[url];
    if (!fixture) {
      throw new Error(`unexpected wardrobe reference request: ${url}`);
    }
    return new Response(fixture.bytes, {
      headers: { "content-type": fixture.contentType },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const visualizationContext = {
  retailerName: "PAON Atelier",
  referenceImageUrls: [
    "https://example.test/reference-1.jpg",
    "https://example.test/reference-2.png",
  ],
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
  it("downloads supported references, submits a gpt-image-2 edit, and returns a data URL", async () => {
    const referenceOne = Uint8Array.from([1, 2, 3, 4]);
    const referenceTwo = Uint8Array.from([5, 6, 7, 8, 9]);
    const fetchMock = mockReferenceFetch({
      "https://example.test/reference-1.jpg": {
        bytes: referenceOne,
        contentType: "image/jpeg",
      },
      "https://example.test/reference-2.png": {
        bytes: referenceTwo,
        contentType: "image/png",
      },
    });
    const { client, edit } = fakeOpenAI([
      {
        b64_json: "cGFuZWwtaW1hZ2UtYnl0ZXM=",
        revised_prompt: "revised wardrobe prompt",
      },
    ]);
    const provider = new OpenAIProvider(client);

    const result =
      await provider.generateWardrobeVisualization(visualizationContext);

    expect(result).toEqual({
      imageUrl: "data:image/png;base64,cGFuZWwtaW1hZ2UtYnl0ZXM=",
      revisedPrompt: "revised wardrobe prompt",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.test/reference-1.jpg",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.test/reference-2.png",
    );

    const request = edit.mock.calls[0]?.[0] as WardrobeEditRequest;
    expect(request.model).toBe("gpt-image-2");
    expect(request.n).toBe(1);
    expect(request.size).toBe("1024x1024");
    expect(request.output_format).toBe("png");
    expect(request.prompt).toContain(
      "The same person shown in the supplied reference images, identity and proportions preserved exactly",
    );
    expect(request.prompt).toContain(
      "Do not slim, reshape, age-reduce or change the skin tone of the person.",
    );
    expect(request.prompt).toContain("Navy two-piece suit, White dress shirt");
    expect(request.prompt).toContain("Avoid: no visible logos.");
    expect(request.image).toHaveLength(2);
    const firstImage = request.image[0]!;
    const secondImage = request.image[1]!;
    expect(firstImage).toMatchObject({
      name: "wardrobe-reference-1.jpg",
      type: "image/jpeg",
      size: referenceOne.byteLength,
    });
    expect(new Uint8Array(await firstImage.arrayBuffer())).toEqual(
      referenceOne,
    );
    expect(secondImage).toMatchObject({
      name: "wardrobe-reference-2.png",
      type: "image/png",
      size: referenceTwo.byteLength,
    });
    expect(new Uint8Array(await secondImage.arrayBuffer())).toEqual(
      referenceTwo,
    );
  });

  it("throws when the edit response is empty", async () => {
    const { client } = fakeOpenAI([]);
    mockReferenceFetch({
      "https://example.test/reference-1.jpg": {
        bytes: Uint8Array.from([1, 2, 3, 4]),
        contentType: "image/jpeg",
      },
      "https://example.test/reference-2.png": {
        bytes: Uint8Array.from([5, 6, 7, 8, 9]),
        contentType: "image/png",
      },
    });
    const provider = new OpenAIProvider(client);

    await expect(
      provider.generateWardrobeVisualization(visualizationContext),
    ).rejects.toThrow("missing image data");
  });

  it("throws when no reference image is provided", async () => {
    const { client, edit } = fakeOpenAI([
      { b64_json: "cGFuZWwtaW1hZ2UtYnl0ZXM=" },
    ]);
    const provider = new OpenAIProvider(client);

    await expect(
      provider.generateWardrobeVisualization({
        ...visualizationContext,
        referenceImageUrls: [],
      }),
    ).rejects.toThrow("at least one reference image");
    expect(edit).not.toHaveBeenCalled();
  });

  it("throws when a reference image type is unsupported", async () => {
    const { client, edit } = fakeOpenAI([
      { b64_json: "cGFuZWwtaW1hZ2UtYnl0ZXM=" },
    ]);
    mockReferenceFetch({
      "https://example.test/reference-1.jpg": {
        bytes: Uint8Array.from([1, 2, 3, 4]),
        contentType: "text/plain",
      },
    });
    const provider = new OpenAIProvider(client);

    await expect(
      provider.generateWardrobeVisualization({
        ...visualizationContext,
        referenceImageUrls: ["https://example.test/reference-1.jpg"],
      }),
    ).rejects.toThrow("unsupported image type");
    expect(edit).not.toHaveBeenCalled();
  });

  it("throws when a reference image is oversized", async () => {
    const { client, edit } = fakeOpenAI([
      { b64_json: "cGFuZWwtaW1hZ2UtYnl0ZXM=" },
    ]);
    mockReferenceFetch({
      "https://example.test/reference-1.jpg": {
        bytes: new Uint8Array(50 * 1024 * 1024 + 1),
        contentType: "image/jpeg",
      },
    });
    const provider = new OpenAIProvider(client);

    await expect(
      provider.generateWardrobeVisualization({
        ...visualizationContext,
        referenceImageUrls: ["https://example.test/reference-1.jpg"],
      }),
    ).rejects.toThrow("must be between 1 byte and 50 MB");
    expect(edit).not.toHaveBeenCalled();
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
