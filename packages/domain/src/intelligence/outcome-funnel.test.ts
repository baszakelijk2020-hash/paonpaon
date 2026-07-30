import { describe, expect, it } from "vitest";

import {
  classifyOpportunityOutcome,
  projectOutcomeFunnel,
} from "./outcome-funnel";

describe("outcome funnel", () => {
  it("classifies linked outcomes and no-response completions", () => {
    const funnel = projectOutcomeFunnel([
      {
        status: "completed",
        outcomeMessageId: "msg-1",
      },
      {
        status: "completed",
        outcomeAppointmentId: "appt-1",
      },
      {
        status: "completed",
        outcomeOrderId: "order-1",
      },
      {
        status: "completed",
      },
      {
        status: "accepted",
      },
    ]);

    expect(funnel.message).toBe(1);
    expect(funnel.appointment).toBe(1);
    expect(funnel.sale).toBe(1);
    expect(funnel.noResponse).toBe(1);
    expect(funnel.pending).toBe(1);
    expect(funnel.completedTotal).toBe(4);
  });

  it("prefers sale over other outcome links", () => {
    expect(
      classifyOpportunityOutcome({
        status: "completed",
        outcomeOrderId: "order-1",
        outcomeMessageId: "msg-1",
      }),
    ).toBe("sale");
  });
});
