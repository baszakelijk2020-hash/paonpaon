import { describe, expect, it } from "vitest";

import {
  asId,
  type MetadataConceptId,
  type OrderId,
} from "../shared/branded-id";

import {
  clampMilestonePoints,
  defaultBuiltInMilestoneDefinitions,
  evaluateLoyaltyMilestones,
  isAdvancedFabricConcept,
  isPremiumConstructionConcept,
  LOYALTY_MILESTONE_POINTS_CAP,
  milestonePresentation,
  resolveMilestoneCorrections,
  type MilestoneOrderFacts,
} from "./loyalty-milestones";
import {
  loyaltyMilestoneDefinitionSchema,
  upsertBuiltInMilestonePointsSchema,
} from "./loyalty-milestones.schema";

const orderId = asId<"OrderId">("11111111-1111-4111-8111-111111111111");
const orderId2 = asId<"OrderId">("22222222-2222-4222-8222-222222222222");
const jacket = asId<"MetadataConceptId">(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
);
const trousers = asId<"MetadataConceptId">(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
);
const fullCanvas = asId<"MetadataConceptId">(
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
);
const cashmere = asId<"MetadataConceptId">(
  "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
);
const peerConcept = asId<"MetadataConceptId">(
  "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
);

function order(args: {
  id: OrderId;
  status?: MilestoneOrderFacts["status"];
  createdAt?: string;
  commission?: boolean;
  garmentTypes?: Array<{
    conceptId: MetadataConceptId;
    name: string;
  }>;
  constructions?: Array<{
    conceptId: MetadataConceptId;
    slug: string;
    name: string;
  }>;
  fibres?: Array<{
    conceptId: MetadataConceptId;
    slug: string;
    name: string;
  }>;
}): MilestoneOrderFacts {
  return {
    orderId: args.id,
    status: args.status ?? "delivered",
    createdAt: args.createdAt ?? "2026-07-01T10:00:00.000Z",
    lines: [
      {
        requiresProduction: args.commission ?? false,
        garmentTypeConcepts: (args.garmentTypes ?? []).map((item) => ({
          conceptId: item.conceptId,
          kind: "garment_type",
          slug: item.name.toLowerCase().replaceAll(" ", "-"),
          canonicalName: item.name,
        })),
        constructionConcepts: (args.constructions ?? []).map((item) => ({
          conceptId: item.conceptId,
          kind: "construction",
          slug: item.slug,
          canonicalName: item.name,
        })),
        fibreConcepts: (args.fibres ?? []).map((item) => ({
          conceptId: item.conceptId,
          kind: "fibre",
          slug: item.slug,
          canonicalName: item.name,
        })),
      },
    ],
  };
}

describe("loyalty milestone concept detectors", () => {
  it("recognises premium construction and advanced fabric slugs", () => {
    expect(
      isPremiumConstructionConcept({
        kind: "construction",
        slug: "full-canvas",
      }),
    ).toBe(true);
    expect(
      isAdvancedFabricConcept({ kind: "fibre", slug: "cashmere-blend" }),
    ).toBe(true);
    expect(
      isPremiumConstructionConcept({
        kind: "construction",
        slug: "fused",
      }),
    ).toBe(false);
  });

  it("caps points and rejects gambling presentation language", () => {
    expect(clampMilestonePoints(5000)).toBe(LOYALTY_MILESTONE_POINTS_CAP);
    const presentation = milestonePresentation({
      kind: "first_commission",
      label: "First commission",
      points: 250,
      status: "awarded",
    });
    expect(presentation.tone).toBe("recognition");
    expect(presentation.detail.toLowerCase()).not.toMatch(
      /spin|streak|chance|gamble|jackpot|random/,
    );
  });
});

describe("evaluateLoyaltyMilestones", () => {
  const definitions = defaultBuiltInMilestoneDefinitions();

  it("awards first commission once for the first made-to-order delivery", () => {
    const first = evaluateLoyaltyMilestones({
      definitions,
      existingAwards: [],
      priorOrders: [],
      currentOrder: order({ id: orderId, commission: true }),
    });
    expect(first.map((item) => item.kind)).toContain("first_commission");

    const replay = evaluateLoyaltyMilestones({
      definitions,
      existingAwards: [
        {
          kind: "first_commission",
          idempotencyKey: "first_commission",
          status: "awarded",
          relatedOrderId: orderId,
        },
      ],
      priorOrders: [order({ id: orderId, commission: true })],
      currentOrder: order({
        id: orderId2,
        commission: true,
        createdAt: "2026-07-10T10:00:00.000Z",
      }),
    });
    expect(replay.map((item) => item.kind)).not.toContain("first_commission");
  });

  it("awards repeat order on the second qualifying delivery", () => {
    const result = evaluateLoyaltyMilestones({
      definitions,
      existingAwards: [],
      priorOrders: [order({ id: orderId })],
      currentOrder: order({
        id: orderId2,
        createdAt: "2026-07-10T10:00:00.000Z",
      }),
    });
    expect(result.map((item) => item.kind)).toContain("repeat_order");
  });

  it("awards new category only for previously unseen garment types", () => {
    const result = evaluateLoyaltyMilestones({
      definitions,
      existingAwards: [],
      priorOrders: [
        order({
          id: orderId,
          garmentTypes: [{ conceptId: jacket, name: "Jacket" }],
        }),
      ],
      currentOrder: order({
        id: orderId2,
        createdAt: "2026-07-10T10:00:00.000Z",
        garmentTypes: [
          { conceptId: jacket, name: "Jacket" },
          { conceptId: trousers, name: "Trousers" },
        ],
      }),
    });
    const category = result.filter((item) => item.kind === "new_category");
    expect(category).toHaveLength(1);
    expect(category[0]?.relatedConceptId).toBe(trousers);
    expect(category[0]?.idempotencyKey).toBe(`new_category:${trousers}`);
  });

  it("awards premium construction and advanced fabric from accepted concepts", () => {
    const result = evaluateLoyaltyMilestones({
      definitions,
      existingAwards: [],
      priorOrders: [],
      currentOrder: order({
        id: orderId,
        constructions: [
          {
            conceptId: fullCanvas,
            slug: "full-canvas",
            name: "Full canvas",
          },
        ],
        fibres: [{ conceptId: cashmere, slug: "cashmere", name: "Cashmere" }],
      }),
    });
    expect(result.map((item) => item.kind).sort()).toEqual([
      "advanced_fabric",
      "premium_construction",
    ]);
  });

  it("awards configured peer milestones idempotently", () => {
    const peer = {
      kind: "custom" as const,
      customKey: "wedding-season",
      label: "Wedding season cloth",
      explanation: "Recognised for commissioning wedding-season cloth.",
      points: 175,
      matchConceptIds: [peerConcept],
      active: true,
    };
    const first = evaluateLoyaltyMilestones({
      definitions: [...definitions, peer],
      existingAwards: [],
      priorOrders: [],
      currentOrder: order({
        id: orderId,
        fibres: [
          {
            conceptId: peerConcept,
            slug: "wedding-wool",
            name: "Wedding wool",
          },
        ],
      }),
    });
    expect(first.some((item) => item.kind === "custom")).toBe(true);

    const replay = evaluateLoyaltyMilestones({
      definitions: [...definitions, peer],
      existingAwards: [
        {
          kind: "custom",
          idempotencyKey: "custom:wedding-season",
          status: "awarded",
          relatedOrderId: orderId,
        },
      ],
      priorOrders: [],
      currentOrder: order({
        id: orderId,
        fibres: [
          {
            conceptId: peerConcept,
            slug: "wedding-wool",
            name: "Wedding wool",
          },
        ],
      }),
    });
    expect(replay.some((item) => item.kind === "custom")).toBe(false);
  });

  it("ignores non-qualifying statuses", () => {
    const result = evaluateLoyaltyMilestones({
      definitions,
      existingAwards: [],
      priorOrders: [],
      currentOrder: order({ id: orderId, status: "placed", commission: true }),
    });
    expect(result).toEqual([]);
  });
});

describe("resolveMilestoneCorrections", () => {
  it("reverses awards tied to a refunded order", () => {
    const corrections = resolveMilestoneCorrections({
      existingAwards: [
        {
          kind: "first_commission",
          idempotencyKey: "first_commission",
          status: "awarded",
          relatedOrderId: orderId,
          points: 250,
        },
        {
          kind: "repeat_order",
          idempotencyKey: "repeat_order",
          status: "awarded",
          relatedOrderId: orderId2,
          points: 150,
        },
      ],
      orderId,
      orderStatus: "refunded",
    });
    expect(corrections).toEqual([
      {
        idempotencyKey: "first_commission",
        kind: "first_commission",
        relatedOrderId: orderId,
        points: 250,
      },
    ]);
  });

  it("does not reverse when status is still qualifying", () => {
    expect(
      resolveMilestoneCorrections({
        existingAwards: [
          {
            kind: "first_commission",
            idempotencyKey: "first_commission",
            status: "awarded",
            relatedOrderId: orderId,
            points: 250,
          },
        ],
        orderId,
        orderStatus: "delivered",
      }),
    ).toEqual([]);
  });
});

describe("loyalty milestone schemas", () => {
  it("requires a custom key and concept match for peer milestones", () => {
    expect(
      loyaltyMilestoneDefinitionSchema.safeParse({
        kind: "custom",
        label: "Peer",
        explanation: "A peer milestone.",
        points: 100,
        matchConceptIds: [],
      }).success,
    ).toBe(false);
    expect(
      loyaltyMilestoneDefinitionSchema.parse({
        kind: "custom",
        customKey: "house-tweed",
        label: "House tweed",
        explanation: "Recognised for house tweed.",
        points: "120",
        matchConceptIds: [peerConcept],
      }).points,
    ).toBe(120);
  });

  it("caps built-in point edits", () => {
    expect(
      upsertBuiltInMilestonePointsSchema.safeParse({
        kind: "first_commission",
        points: 5001,
      }).success,
    ).toBe(false);
  });
});
