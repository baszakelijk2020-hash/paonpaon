import { describe, expect, it, vi } from "vitest";

import {
  MockGroundedAnswerProvider,
  runGroundedAnswerJob,
} from "./grounded-answer-runner";
import { OpenAIProvider } from "./openai-provider";

function fakeOpenAI(content: string | null) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  });
  return { client: { chat: { completions: { create } } } as never, create };
}

const groundedContext = {
  retailerName: "Maison Test",
  question: "What should I wear to a summer wedding?",
  occasionLabel: "a summer wedding",
  knowledge: [
    {
      knowledgeObjectId: "k1",
      title: "Wedding occasion dressing",
      summary: "Lighter weaves for warm weddings.",
    },
  ],
  products: [
    {
      productId: "p1",
      name: "Linen jacket",
      explanation: "Matched warm climate",
    },
  ],
};

describe("OpenAIProvider.generateGroundedAnswer", () => {
  it("parses allowlisted citations", async () => {
    const { client, create } = fakeOpenAI(
      JSON.stringify({
        refuse: false,
        answerText: "Choose a lighter weave.",
        uncertaintyNote: "Confirm in store.",
        knowledgeObjectIds: ["k1"],
        productIds: ["p1"],
      }),
    );
    const provider = new OpenAIProvider(client);
    const result = await provider.generateGroundedAnswer(groundedContext);
    expect(result.refuse).toBe(false);
    expect(result.knowledgeObjectIds).toEqual(["k1"]);
    expect(result.productIds).toEqual(["p1"]);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: "json_object" },
      }),
    );
  });

  it("rejects citations outside the allowlist", async () => {
    const { client } = fakeOpenAI(
      JSON.stringify({
        refuse: false,
        answerText: "Invented",
        knowledgeObjectIds: ["k-forged"],
        productIds: [],
      }),
    );
    const provider = new OpenAIProvider(client);
    await expect(
      provider.generateGroundedAnswer(groundedContext),
    ).rejects.toThrow("outside the allowlist");
  });

  it("refuses when no approved basis is provided", async () => {
    const { client } = fakeOpenAI("{}");
    const provider = new OpenAIProvider(client);
    const result = await provider.generateGroundedAnswer({
      ...groundedContext,
      knowledge: [],
      products: [],
    });
    expect(result.refuse).toBe(true);
    expect(result.refuseReason).toBe("no_approved_basis");
  });
});

describe("MockGroundedAnswerProvider", () => {
  it("returns allowlisted mock citations", async () => {
    const provider = new MockGroundedAnswerProvider();
    const result = await provider.generateGroundedAnswer(groundedContext);
    expect(result.refuse).toBe(false);
    expect(result.knowledgeObjectIds).toEqual(["k1"]);
    expect(result.productIds).toEqual(["p1"]);
  });

  it("runGroundedAnswerJob captures provider failures", async () => {
    const provider = new MockGroundedAnswerProvider({
      errorMessage: "provider down",
    });
    const job = await runGroundedAnswerJob(provider, groundedContext);
    expect(job.ok).toBe(false);
    expect(job.errorMessage).toBe("provider down");
  });
});
