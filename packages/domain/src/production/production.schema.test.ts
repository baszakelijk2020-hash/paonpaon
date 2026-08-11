import { describe, expect, it } from "vitest";

import {
  canRetailerRoleTransitionAlteration,
  canTransitionAlteration,
} from "./production";
import {
  addAlterationUpdateInputSchema,
  createAlterationInputSchema,
  proposePriceChangeInputSchema,
  recordCostAllocationInputSchema,
  recordCustodyEventInputSchema,
  recordFulfillmentInputSchema,
} from "./production.schema";

const baseIntake = {
  customerId: "11111111-1111-1111-1111-111111111111",
  sourceKind: "external",
  categoryCode: "jacket",
  garmentType: "Single-breasted jacket",
  description: "Navy hopsack jacket with brass buttons.",
  labelMetadata: { maker: "House label" },
  intakeCondition: "Clean; light wear at cuffs; no visible damage.",
  observations: [
    {
      area: "Right sleeve",
      observation: "8 mm long at cuff",
      classification: "work_now",
    },
  ],
  tasks: [{ title: "Shorten right sleeve 8 mm", classification: "work_now" }],
} as const;

describe("createAlterationInputSchema", () => {
  it("accepts a fully identified external garment intake", () => {
    expect(createAlterationInputSchema.parse(baseIntake).sourceKind).toBe(
      "external",
    );
  });

  it("requires an order reference for a finished MTM garment", () => {
    const result = createAlterationInputSchema.safeParse({
      ...baseIntake,
      sourceKind: "finished_mtm",
    });
    expect(result.success).toBe(false);
  });

  it("accepts future-order observations while requiring current work", () => {
    const result = createAlterationInputSchema.safeParse({
      ...baseIntake,
      tasks: [
        ...baseIntake.tasks,
        {
          title: "Lower button stance next order",
          classification: "future_order_note",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a work order containing only future-order notes", () => {
    const result = createAlterationInputSchema.safeParse({
      ...baseIntake,
      tasks: [{ title: "Future note", classification: "future_order_note" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("alteration transitions", () => {
  it("allows the operational happy path", () => {
    expect(canTransitionAlteration("approved", "assigned")).toBe(true);
    expect(canTransitionAlteration("in_progress", "completion_review")).toBe(
      true,
    );
    expect(canTransitionAlteration("ready_for_pickup", "completed")).toBe(true);
  });

  it("rejects reopening terminal or skipping review states", () => {
    expect(canTransitionAlteration("completed", "in_progress")).toBe(false);
    expect(canTransitionAlteration("in_progress", "ready_for_pickup")).toBe(
      false,
    );
  });

  it("limits workshop, advisor and pricing approval transitions by role", () => {
    expect(
      canRetailerRoleTransitionAlteration("worker", "assigned", "in_progress"),
    ).toBe(true);
    expect(
      canRetailerRoleTransitionAlteration("worker", "assigned", "canceled"),
    ).toBe(false);
    expect(
      canRetailerRoleTransitionAlteration(
        "sales_associate",
        "quoted",
        "approved",
      ),
    ).toBe(false);
    expect(
      canRetailerRoleTransitionAlteration("manager", "quoted", "approved"),
    ).toBe(true);
  });
});

describe("pricing and update validation", () => {
  it("requires a substantive workshop price explanation", () => {
    expect(
      proposePriceChangeInputSchema.safeParse({
        proposedAmountMinorUnits: 12000,
        explanation: "Too short",
      }).success,
    ).toBe(false);
  });

  it("defaults customer visibility to false", () => {
    expect(
      addAlterationUpdateInputSchema.parse({ status: "quoted" })
        .customerVisible,
    ).toBe(false);
  });
});

describe("cost allocation validation", () => {
  const validAllocation = {
    labourCostAmountMinorUnits: 1000,
    materialCostAmountMinorUnits: 500,
    partnerCostAmountMinorUnits: 0,
    currency: "USD",
    reason: "Workshop invoice #4821",
  };

  it("accepts a fully specified allocation", () => {
    expect(
      recordCostAllocationInputSchema.safeParse(validAllocation).success,
    ).toBe(true);
  });

  it("rejects a negative cost component", () => {
    expect(
      recordCostAllocationInputSchema.safeParse({
        ...validAllocation,
        materialCostAmountMinorUnits: -100,
      }).success,
    ).toBe(false);
  });

  it("rejects a currency code that is not three letters", () => {
    expect(
      recordCostAllocationInputSchema.safeParse({
        ...validAllocation,
        currency: "US",
      }).success,
    ).toBe(false);
  });

  it("requires a substantive reason", () => {
    expect(
      recordCostAllocationInputSchema.safeParse({
        ...validAllocation,
        reason: "x",
      }).success,
    ).toBe(false);
  });
});

describe("release evidence validation", () => {
  it("requires a named recipient for customer release", () => {
    expect(
      recordCustodyEventInputSchema.safeParse({
        eventType: "released_to_customer",
      }).success,
    ).toBe(false);
  });

  it("requires recipient and verification when fulfillment completes", () => {
    expect(
      recordFulfillmentInputSchema.safeParse({
        method: "pickup",
        status: "completed",
        releasedToName: "Alex Customer",
      }).success,
    ).toBe(false);
    expect(
      recordFulfillmentInputSchema.safeParse({
        method: "pickup",
        status: "completed",
        releasedToName: "Alex Customer",
        verificationNote: "Photo ID checked by advisor.",
      }).success,
    ).toBe(true);
  });

  it("requires an address for delivery fulfillment", () => {
    expect(
      recordFulfillmentInputSchema.safeParse({
        method: "delivery",
        status: "scheduled",
      }).success,
    ).toBe(false);
    expect(
      recordFulfillmentInputSchema.safeParse({
        method: "delivery",
        status: "scheduled",
        deliveryAddress: {
          line1: "1 Savile Row",
          city: "London",
          postalCode: "W1S 3PR",
          countryCode: "gb",
        },
      }).success,
    ).toBe(true);
  });
});
