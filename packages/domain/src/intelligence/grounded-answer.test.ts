import { describe, expect, it } from "vitest";

import type { CatalogueRelevanceFactor } from "../catalog/catalogue-query";
import type { KnowledgeDiscoveryResult } from "../knowledge/knowledge-discovery";
import { asId } from "../shared/branded-id";

import {
  buildDeterministicGroundedAnswer,
  buildGroundedAllowlist,
  buildOccasionGuidancePlan,
  citationsWithinAllowlist,
  formatGuidanceWidgetLines,
  refuseGroundedAnswer,
  resolveOccasionQuery,
  validateGroundedAnswer,
  type GroundedAnswer,
  type GroundedKnowledgeCard,
  type GroundedShortlistItem,
} from "./grounded-answer";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const knowledgeId = asId<"KnowledgeObjectId">(
  "77777777-7777-4777-8777-777777777777",
);
const productId = asId<"ProductId">("55555555-5555-4555-8555-555555555555");
const otherProductId = asId<"ProductId">(
  "66666666-6666-4666-8666-666666666666",
);

const factors: CatalogueRelevanceFactor[] = [
  {
    code: "intent_match",
    delta: 1,
    detail: "Matched summer wedding intent",
  },
];

function shortlistItem(
  overrides?: Partial<GroundedShortlistItem>,
): GroundedShortlistItem {
  return {
    productId,
    name: "Linen summer jacket",
    slug: "linen-summer-jacket",
    explanation: "Matched wedding occasion and warm climate",
    factors,
    matchedConceptIds: ["concept-wedding"],
    ...overrides,
  };
}

function knowledgeCard(
  overrides?: Partial<GroundedKnowledgeCard>,
): GroundedKnowledgeCard {
  return {
    knowledgeObjectId: knowledgeId,
    title: "Wedding occasion dressing",
    summary: "Choose lighter weaves and breathable fibres for warm weddings.",
    factors: [
      {
        code: "journey_relevance",
        delta: 0.7,
        detail: "Advisor journey favours occasion education",
      },
    ],
    matchedConceptIds: ["concept-wedding"],
    ...overrides,
  };
}

describe("grounded answer allowlist", () => {
  it("accepts citations only from the approved retrieval set", () => {
    const allowlist = buildGroundedAllowlist({
      knowledgeObjectIds: [knowledgeId],
      productIds: [productId],
    });
    expect(
      citationsWithinAllowlist(
        [
          {
            kind: "knowledge",
            id: knowledgeId,
            title: "Wedding occasion dressing",
          },
          { kind: "product", id: productId, title: "Linen summer jacket" },
        ],
        allowlist,
      ),
    ).toBe(true);
    expect(
      citationsWithinAllowlist(
        [{ kind: "product", id: otherProductId, title: "Invented" }],
        allowlist,
      ),
    ).toBe(false);
  });

  it("refuses answers that cite outside the allowlist", () => {
    const allowlist = buildGroundedAllowlist({
      knowledgeObjectIds: [knowledgeId],
      productIds: [productId],
    });
    const answer: GroundedAnswer = {
      status: "answered",
      answerText: "Buy this invented product.",
      citations: [
        { kind: "product", id: otherProductId, title: "Invented product" },
      ],
      handoffRecommended: false,
    };
    const validated = validateGroundedAnswer(answer, allowlist);
    expect(validated.status).toBe("refused");
    expect(validated.refusalReason).toBe("citation_outside_allowlist");
    expect(validated.handoffRecommended).toBe(true);
  });

  it("refuses answered status with empty citations", () => {
    const allowlist = buildGroundedAllowlist({
      knowledgeObjectIds: [],
      productIds: [],
    });
    const validated = validateGroundedAnswer(
      {
        status: "answered",
        answerText: "Trust me.",
        citations: [],
        handoffRecommended: false,
      },
      allowlist,
    );
    expect(validated.status).toBe("refused");
    expect(validated.refusalReason).toBe("no_approved_basis");
  });

  it("keeps explicit refusals and always recommends handoff", () => {
    const refused = refuseGroundedAnswer("unsupported_question");
    expect(refused.status).toBe("refused");
    expect(refused.handoffRecommended).toBe(true);
    expect(refused.answerText.toLowerCase()).toContain("advisor");
  });
});

describe("deterministic grounded answer", () => {
  it("builds an explainable answer from knowledge and shortlist", () => {
    const answer = buildDeterministicGroundedAnswer({
      occasionLabel: "a summer wedding",
      knowledgeCards: [knowledgeCard()],
      shortlist: [shortlistItem()],
    });
    expect(answer.status).toBe("answered");
    expect(answer.citations).toHaveLength(2);
    expect(answer.uncertaintyNote).toBeDefined();
    expect(answer.handoffRecommended).toBe(true);
    expect(answer.answerText).toContain("summer wedding");
    expect(answer.answerText).toContain("Wedding occasion dressing");
  });

  it("refuses when there is no approved basis", () => {
    const answer = buildDeterministicGroundedAnswer({
      occasionLabel: "a summer wedding",
      knowledgeCards: [],
      shortlist: [],
    });
    expect(answer.status).toBe("refused");
    expect(answer.refusalReason).toBe("no_approved_basis");
  });
});

describe("resolveOccasionQuery", () => {
  it("maps summer wedding language and wedding intent", () => {
    expect(
      resolveOccasionQuery({
        freeText: "summer-chic wedding in May 2027",
      }),
    ).toEqual({ query: "summer wedding", label: "a summer wedding" });
    expect(resolveOccasionQuery({ intent: "wedding" }).query).toBe(
      "summer wedding",
    );
  });
});

describe("buildOccasionGuidancePlan", () => {
  it("keeps handoff visible and wires swipe/appointment paths", () => {
    const discovery: KnowledgeDiscoveryResult = {
      knowledgeObjectId: knowledgeId,
      topic: "occasion",
      presentation: {
        title: "Wedding occasion dressing",
        summary: "Choose lighter weaves.",
        priority: 10,
        isPinned: false,
        isHidden: false,
      },
      score: 2,
      factors: [
        {
          code: "journey_relevance",
          delta: 0.7,
          detail: "Advisor journey",
        },
      ],
      matchedConceptIds: [
        asId<"MetadataConceptId">("44444444-4444-4444-8444-444444444444"),
      ],
    };

    const plan = buildOccasionGuidancePlan({
      retailerId,
      slug: "maison-demo",
      occasionQuery: "summer wedding",
      occasionLabel: "a summer wedding",
      intent: "wedding",
      knowledgeResults: [discovery],
      knowledgeById: new Map([
        [
          knowledgeId,
          {
            title: "Wedding occasion dressing",
            summary: "Choose lighter weaves.",
          },
        ],
      ]),
      shortlist: [shortlistItem()],
    });

    expect(plan.handoffVisible).toBe(true);
    expect(plan.answer.status).toBe("answered");
    expect(plan.swipePath).toContain("/r/maison-demo/swipe?");
    expect(plan.swipePath).toContain("occasion=summer");
    expect(plan.appointmentPath).toContain("/r/maison-demo/appointments?");
    expect(plan.messagesPath).toBe("/messages");

    const lines = formatGuidanceWidgetLines(plan);
    expect(lines.some((line) => line.includes("Book advisor"))).toBe(true);
    expect(lines.some((line) => line.includes("Message advisor"))).toBe(true);
  });

  it("rejects AI answers that invent product citations", () => {
    const plan = buildOccasionGuidancePlan({
      retailerId,
      slug: "maison-demo",
      occasionQuery: "summer wedding",
      occasionLabel: "a summer wedding",
      knowledgeResults: [],
      knowledgeById: new Map(),
      shortlist: [shortlistItem()],
      aiAnswer: {
        status: "answered",
        answerText: "Invented claim",
        citations: [
          {
            kind: "product",
            id: otherProductId,
            title: "Not in shortlist",
          },
        ],
        handoffRecommended: false,
      },
    });
    expect(plan.answer.status).toBe("refused");
    expect(plan.answer.refusalReason).toBe("citation_outside_allowlist");
    expect(plan.handoffVisible).toBe(true);
  });
});
