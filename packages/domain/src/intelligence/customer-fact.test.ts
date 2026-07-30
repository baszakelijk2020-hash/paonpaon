import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  factsFromAdvisorRectangles,
  mayAssignProvenance,
  mayPromoteFact,
  validateCustomerFactDraft,
} from "./customer-fact";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const staffId = asId<"StaffId">("55555555-5555-4555-8555-555555555555");
const brownId = asId<"MetadataConceptId">(
  "66666666-6666-4666-8666-666666666666",
);

describe("customer facts provenance", () => {
  it("forbids inferring employer/industry/bonus month", () => {
    expect(
      mayAssignProvenance({
        factType: "employer",
        provenanceClass: "behaviour_inferred",
      }),
    ).toBe(false);
    expect(
      validateCustomerFactDraft({
        factType: "bonus_month",
        provenanceClass: "behaviour_inferred",
        valueLabel: "March",
        confidence: 0.5,
      }).errors,
    ).toContain("declared_only_cannot_be_inferred");
  });

  it("refuses promoting inferences into declared facts", () => {
    expect(
      mayPromoteFact({
        from: "behaviour_inferred",
        to: "customer_declared",
      }),
    ).toBe(false);
    expect(
      mayPromoteFact({
        from: "advisor_observed",
        to: "customer_declared",
      }),
    ).toBe(true);
  });

  it("maps advisor rectangles to advisor-observed facts", () => {
    const result = factsFromAdvisorRectangles({
      retailerId,
      customerId,
      authorStaffId: staffId,
      observedAt: "2026-07-30T12:00:00.000Z",
      selections: [
        {
          conceptId: brownId,
          kind: "colour",
          label: "Brown",
          polarity: "positive",
        },
      ],
      freeformNote: "Prefers soft construction",
    });
    expect(result.ok).toBe(true);
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0]).toMatchObject({
      factType: "colour_interest",
      provenanceClass: "advisor_observed",
      valueLabel: "Brown",
      authorStaffId: staffId,
    });
    expect(result.drafts[1]?.visibility).toBe("advisor_only");
  });
});
