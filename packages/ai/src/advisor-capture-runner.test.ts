import { describe, expect, it, vi } from "vitest";

import {
  MockAdvisorCaptureProvider,
  runAdvisorCaptureJob,
} from "./advisor-capture-runner";
import { OpenAIProvider } from "./openai-provider";

function fakeOpenAI(content: string | null) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  });
  return { client: { chat: { completions: { create } } } as never, create };
}

const captureContext = {
  rawText:
    "Mr Brown wants black oxford shoes and promised a call Friday about the linen jackets.",
  retailerName: "PAON Atelier",
  customerName: "Mr Brown",
  asOfDate: "2026-08-04",
};

describe("OpenAIProvider advisor capture", () => {
  it("sends the capture system prompt and returns parsed JSON", async () => {
    const payload = {
      bundles: [
        {
          kind: "self_portrait_fact",
          summary: "Prefers black oxford shoes",
          sourceExcerpt: "wants black oxford shoes",
          confidence: 0.9,
          payload: { factType: "colour_interest", valueLabel: "Black oxfords" },
        },
      ],
    };
    const { client, create } = fakeOpenAI(JSON.stringify(payload));
    const provider = new OpenAIProvider(client);

    const result = await provider.extractAdvisorCaptureBundles(captureContext);

    expect(result).toEqual(payload);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: "json_object" },
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("quote a real, exact"),
          }),
        ]),
      }),
    );
  });

  it("throws on invalid capture JSON", async () => {
    const { client } = fakeOpenAI("not-json");
    const provider = new OpenAIProvider(client);
    await expect(
      provider.extractAdvisorCaptureBundles(captureContext),
    ).rejects.toThrow("not valid JSON");
  });
});

describe("runAdvisorCaptureJob", () => {
  it("returns success from a mock provider", async () => {
    const output = { bundles: [] };
    const provider = new MockAdvisorCaptureProvider({ output });
    const result = await runAdvisorCaptureJob(provider, captureContext);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rawOutput).toEqual(output);
      expect(result.attempts).toBe(1);
      expect(result.provider).toBe("mock");
    }
  });

  it("retries transient failures then reports failure", async () => {
    const provider = new MockAdvisorCaptureProvider({
      failureMessage: "transient",
    });
    const extract = vi.spyOn(provider, "extractAdvisorCaptureBundles");
    const result = await runAdvisorCaptureJob(provider, captureContext, {
      maxAttempts: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempts).toBe(2);
      expect(result.errorMessage).toContain("transient");
    }
    expect(extract).toHaveBeenCalledTimes(2);
  });
});
