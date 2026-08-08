import { describe, expect, it } from "vitest";

import {
  MockCommunicationDraftProvider,
  runCommunicationDraftJob,
} from "./communication-draft-runner";
import { MockGroundedAnswerProvider } from "./grounded-answer-runner";

const context = {
  retailerName: "Maison Test",
  customerName: "Prospect Test",
  latestCustomerMessage: "I need a jacket for Friday.",
  recentMessages: [
    { speaker: "customer" as const, text: "I need a jacket for Friday." },
  ],
  knowledge: [
    { knowledgeObjectId: "k1", title: "Formalwear", summary: "Fit first." },
  ],
  products: [
    { productId: "p1", name: "Dinner jacket", explanation: "Formal option" },
  ],
};

describe("runCommunicationDraftJob", () => {
  it("returns a deterministic allowlisted mock draft", async () => {
    const result = await runCommunicationDraftJob(
      new MockCommunicationDraftProvider(),
      context,
    );
    expect(result.ok).toBe(true);
    expect(result.result?.knowledgeObjectIds).toEqual(["k1"]);
    expect(result.result?.productIds).toEqual(["p1"]);
  });

  it("captures provider failures", async () => {
    const result = await runCommunicationDraftJob(
      new MockCommunicationDraftProvider({ errorMessage: "provider down" }),
      context,
    );
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toBe("provider down");
  });

  it("fails closed when a provider lacks the optional draft capability", async () => {
    const result = await runCommunicationDraftJob(
      new MockGroundedAnswerProvider(),
      context,
    );
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("does not support");
  });
});
