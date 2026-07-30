import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import { factsFromAppointmentCloseout } from "./appointment-closeout";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const staffId = asId<"StaffId">("44444444-4444-4444-8444-444444444444");
const appointmentId = asId<"AppointmentId">(
  "55555555-5555-4555-8555-555555555555",
);
const conceptId = asId<"MetadataConceptId">(
  "66666666-6666-4666-8666-666666666666",
);

describe("appointment closeout", () => {
  it("maps closeout rectangles to advisor-observed fact drafts", () => {
    const result = factsFromAppointmentCloseout({
      retailerId,
      appointmentId,
      customerId,
      authorStaffId: staffId,
      outcome: "completed_with_interest",
      observedAt: "2026-07-30T18:00:00.000Z",
      selections: [
        {
          conceptId,
          kind: "colour",
          label: "Brown",
          polarity: "positive",
        },
      ],
      followUpNotes: "Send fresco swatches next week",
    });

    expect(result.ok).toBe(true);
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0]).toMatchObject({
      factType: "colour_interest",
      provenanceClass: "advisor_observed",
      valueLabel: "Brown",
    });
    expect(result.drafts[1]?.visibility).toBe("advisor_only");
  });

  it("rejects empty closeout when outcome is no purchase and no notes", () => {
    const result = factsFromAppointmentCloseout({
      retailerId,
      appointmentId,
      customerId,
      authorStaffId: staffId,
      outcome: "completed_no_purchase",
      observedAt: "2026-07-30T18:00:00.000Z",
      selections: [],
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("empty_closeout");
  });

  it("allows no-purchase closeout with follow-up note only", () => {
    const result = factsFromAppointmentCloseout({
      retailerId,
      appointmentId,
      customerId,
      authorStaffId: staffId,
      outcome: "completed_no_purchase",
      observedAt: "2026-07-30T18:00:00.000Z",
      selections: [],
      followUpNotes: "Price sensitivity on fresco",
    });
    expect(result.ok).toBe(true);
    expect(result.drafts).toHaveLength(1);
  });
});
