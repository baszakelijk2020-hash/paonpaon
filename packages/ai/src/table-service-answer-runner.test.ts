import { describe, expect, it } from "vitest";

import {
  MockTableServiceAnswerProvider,
  runTableServiceAnswerJob,
} from "./table-service-answer-runner";

describe("runTableServiceAnswerJob", () => {
  it("returns provider output on success", async () => {
    const provider = new MockTableServiceAnswerProvider({
      body: "Lightweight linen is ideal.",
      citations: ["a1000000-0000-4000-8000-000000000001"],
      citedProductIds: [],
      uncertainty: "low",
      refused: false,
      handoffRecommended: true,
    });

    const result = await runTableServiceAnswerJob(provider, {
      idempotencyKey: "test-key",
      retailerName: "Demo Tailor",
      question: "What should I wear to a summer wedding?",
      knowledge: [
        {
          knowledgeObjectId: "a1000000-0000-4000-8000-000000000001",
          title: "Summer fabrics",
          summary: "Breathable cloth.",
        },
      ],
      shortlist: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rawOutput).toMatchObject({ body: expect.any(String) });
    }
  });

  it("surfaces provider failures", async () => {
    const provider = new MockTableServiceAnswerProvider(
      {},
      "provider unavailable",
    );

    const result = await runTableServiceAnswerJob(provider, {
      idempotencyKey: "fail-key",
      retailerName: "Demo Tailor",
      question: "Help",
      knowledge: [],
      shortlist: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toContain("provider unavailable");
    }
  });
});
