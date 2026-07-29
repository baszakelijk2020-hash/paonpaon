import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import { outfitSlotConsistencyIssues } from "./outfit";
import {
  canCustomerViewRoadmap,
  nextRoadmapStatus,
  projectAdvisorBriefWardrobeGaps,
  rankRoadmapGaps,
  roadmapTransitionIssues,
  stageCitesApprovedRules,
  type WardrobeRoadmapGap,
  type WardrobeRoadmapGoal,
  type WardrobeRoadmapStage,
} from "./roadmap";
import {
  createWardrobeRoadmapInputSchema,
  transitionWardrobeRoadmapInputSchema,
} from "./roadmap.schema";

const retailer = asId<"RetailerId">("00000000-0000-4000-8000-000000000001");
const customer = asId<"CustomerId">("00000000-0000-4000-8000-000000000011");
const ruleId = asId<"SartorialRuleId">("00000000-0000-4000-8000-00000000a001");
const roadmapId = asId<"WardrobeRoadmapId">(
  "00000000-0000-4000-8000-000000000201",
);

const goals: readonly WardrobeRoadmapGoal[] = [
  {
    id: asId<"WardrobeRoadmapGoalId">("00000000-0000-4000-8000-000000000211"),
    roadmapId,
    retailerId: retailer,
    title: "Build a travel-ready tailored core",
    displayOrder: 0,
  },
];

const gaps: readonly WardrobeRoadmapGap[] = [
  {
    id: asId<"WardrobeRoadmapGapId">("00000000-0000-4000-8000-000000000221"),
    roadmapId,
    retailerId: retailer,
    title: "No summer trousers",
    rank: 2,
    slotKind: "trousers",
    howPurchaseFillsGap: "Adds breathable trousers for warm travel days.",
  },
  {
    id: asId<"WardrobeRoadmapGapId">("00000000-0000-4000-8000-000000000222"),
    roadmapId,
    retailerId: retailer,
    title: "Missing navy jacket",
    rank: 1,
    slotKind: "jacket",
    howPurchaseFillsGap: "Anchors weekday and travel looks.",
  },
];

const stages: readonly WardrobeRoadmapStage[] = [
  {
    id: asId<"WardrobeRoadmapStageId">("00000000-0000-4000-8000-000000000231"),
    roadmapId,
    retailerId: retailer,
    title: "Stage 1 — jacket",
    stageOrder: 1,
    ...(gaps[1]?.id ? { gapId: gaps[1].id } : {}),
    suggestedProductId: asId<"ProductId">(
      "00000000-0000-4000-8000-000000000241",
    ),
    explanation: "Fill the highest-ranked jacket gap with a navy jacket.",
    ruleCitations: [
      {
        ruleId,
        ruleTitle: "Jacket and trousers form the tailored foundation",
        relation: "requires",
        explanation: "Jacket purchases support complete looks with trousers.",
      },
    ],
    factCitations: [
      {
        sourceKind: "catalogue_product",
        sourceId: "00000000-0000-4000-8000-000000000241",
        label: "Navy jacket",
        detail: "Catalogue jacket suggested for the gap",
      },
    ],
  },
];

describe("roadmap ranking and projection", () => {
  it("ranks gaps with lower rank first", () => {
    expect(rankRoadmapGaps(gaps).map((gap) => gap.title)).toEqual([
      "Missing navy jacket",
      "No summer trousers",
    ]);
  });

  it("projects advisor brief wardrobe gaps from ranked gaps", () => {
    const projected = projectAdvisorBriefWardrobeGaps(gaps);
    expect(projected[0]?.title).toBe("Missing navy jacket");
    expect(projected[0]?.rank).toBe(1);
    expect(projected[0]?.howPurchaseFillsGap).toContain("Anchors");
  });
});

describe("roadmapTransitionIssues", () => {
  it("allows advisor submit when goals, gaps, stages, and citations exist", () => {
    expect(
      roadmapTransitionIssues({
        action: "submit_for_approval",
        currentStatus: "draft",
        roadmapRetailerId: retailer,
        roadmapCustomerId: customer,
        goals,
        gaps,
        stages,
        actor: {
          kind: "advisor",
          retailerId: retailer,
          role: "sales_associate",
        },
      }),
    ).toEqual([]);
    expect(nextRoadmapStatus("submit_for_approval")).toBe("pending_approval");
  });

  it("blocks submit without rule or fact citations", () => {
    const bareStage: WardrobeRoadmapStage = {
      ...stages[0]!,
      ruleCitations: [],
      factCitations: [],
      explanation: "",
    };
    expect(
      roadmapTransitionIssues({
        action: "submit_for_approval",
        currentStatus: "draft",
        roadmapRetailerId: retailer,
        roadmapCustomerId: customer,
        goals,
        gaps,
        stages: [bareStage],
        actor: {
          kind: "advisor",
          retailerId: retailer,
          role: "manager",
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        "suggestion_missing_explanation",
        "suggestion_missing_rule_citation",
        "suggestion_missing_fact_citation",
      ]),
    );
  });

  it("lets the customer approve or reject pending plans only", () => {
    expect(
      roadmapTransitionIssues({
        action: "approve",
        currentStatus: "pending_approval",
        roadmapRetailerId: retailer,
        roadmapCustomerId: customer,
        goals,
        gaps,
        stages,
        actor: { kind: "customer", customerId: customer, retailerId: retailer },
      }),
    ).toEqual([]);

    expect(
      roadmapTransitionIssues({
        action: "approve",
        currentStatus: "draft",
        roadmapRetailerId: retailer,
        roadmapCustomerId: customer,
        goals,
        gaps,
        stages,
        actor: { kind: "customer", customerId: customer, retailerId: retailer },
      }),
    ).toContain("invalid_from_status");

    expect(
      roadmapTransitionIssues({
        action: "approve",
        currentStatus: "pending_approval",
        roadmapRetailerId: retailer,
        roadmapCustomerId: customer,
        goals,
        gaps,
        stages,
        actor: {
          kind: "advisor",
          retailerId: retailer,
          role: "manager",
        },
      }),
    ).toContain("customer_only");
  });

  it("denies cross-tenant actors", () => {
    expect(
      roadmapTransitionIssues({
        action: "approve",
        currentStatus: "pending_approval",
        roadmapRetailerId: retailer,
        roadmapCustomerId: customer,
        goals,
        gaps,
        stages,
        actor: {
          kind: "customer",
          customerId: customer,
          retailerId: asId<"RetailerId">(
            "00000000-0000-4000-8000-000000000099",
          ),
        },
      }),
    ).toContain("cross_tenant");
  });

  it("exposes customer-visible statuses", () => {
    expect(canCustomerViewRoadmap("approved")).toBe(true);
    expect(canCustomerViewRoadmap("pending_approval")).toBe(true);
    expect(canCustomerViewRoadmap("draft")).toBe(false);
  });

  it("requires stage citations to reference approved rules", () => {
    expect(
      stageCitesApprovedRules({
        stage: stages[0]!,
        approvedRuleIds: new Set([ruleId]),
      }),
    ).toBe(true);
    expect(
      stageCitesApprovedRules({
        stage: stages[0]!,
        approvedRuleIds: new Set(),
      }),
    ).toBe(false);
  });
});

describe("roadmap schemas", () => {
  it("accepts a full advisor-authored roadmap draft payload", () => {
    const parsed = createWardrobeRoadmapInputSchema.safeParse({
      retailerId: retailer,
      customerId: customer,
      title: "Three-year travel wardrobe",
      horizonLabel: "3 years",
      goals: [{ title: "Travel core", displayOrder: 0 }],
      gaps: [
        {
          title: "Missing navy jacket",
          rank: 1,
          slotKind: "jacket",
          howPurchaseFillsGap: "Anchors looks.",
        },
      ],
      stages: [
        {
          title: "Stage 1",
          stageOrder: 1,
          gapIndex: 0,
          suggestedProductId: "00000000-0000-4000-8000-000000000241",
          explanation: "Buy the jacket first.",
          ruleCitations: [
            {
              ruleId,
              ruleTitle: "Jacket foundation",
              relation: "requires",
              explanation: "Jacket supports trousers pairing.",
            },
          ],
          factCitations: [
            {
              sourceKind: "catalogue_product",
              sourceId: "00000000-0000-4000-8000-000000000241",
              label: "Navy jacket",
              detail: "Suggested catalogue jacket",
            },
          ],
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("parses customer approval transitions", () => {
    const parsed = transitionWardrobeRoadmapInputSchema.safeParse({
      roadmapId,
      action: "approve",
      note: "Looks right.",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("outfitSlotConsistencyIssues", () => {
  it("rejects duplicate slots and dual references", () => {
    expect(
      outfitSlotConsistencyIssues({
        slots: [
          {
            slotKind: "jacket",
            available: true,
            wardrobeItemId: "00000000-0000-4000-8000-000000000101",
            productId: "00000000-0000-4000-8000-000000000102",
          },
          {
            slotKind: "jacket",
            available: true,
            wardrobeItemId: "00000000-0000-4000-8000-000000000103",
          },
        ],
      }),
    ).toEqual(
      expect.arrayContaining([
        "both_wardrobe_and_product",
        "duplicate_slot_kind",
      ]),
    );
  });
});
