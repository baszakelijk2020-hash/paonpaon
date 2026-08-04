import { describe, expect, it } from "vitest";

import {
  checkAddSignal,
  checkCreateOpportunity,
  checkOpportunityStageTransition,
  MAX_OPPORTUNITY_SCORE,
  scoreOpportunity,
} from "./business-development";

describe("checkOpportunityStageTransition", () => {
  it("allows identified -> qualified", () => {
    expect(
      checkOpportunityStageTransition({ from: "identified", to: "qualified" }),
    ).toEqual({ ok: true });
  });

  it("allows qualified -> tender_sent", () => {
    expect(
      checkOpportunityStageTransition({
        from: "qualified",
        to: "tender_sent",
      }),
    ).toEqual({ ok: true });
  });

  it("refuses skipping qualification straight to tender_sent", () => {
    expect(
      checkOpportunityStageTransition({
        from: "identified",
        to: "tender_sent",
      }),
    ).toEqual({ ok: false, reason: "transition_not_allowed" });
  });

  it("refuses any move out of a terminal stage", () => {
    expect(
      checkOpportunityStageTransition({ from: "won", to: "qualified" }),
    ).toEqual({ ok: false, reason: "terminal_stage" });
    expect(
      checkOpportunityStageTransition({ from: "lost", to: "identified" }),
    ).toEqual({ ok: false, reason: "terminal_stage" });
  });

  it("allows losing from any non-terminal stage", () => {
    expect(
      checkOpportunityStageTransition({ from: "identified", to: "lost" }),
    ).toEqual({ ok: true });
    expect(
      checkOpportunityStageTransition({ from: "tender_sent", to: "lost" }),
    ).toEqual({ ok: true });
  });
});

describe("scoreOpportunity", () => {
  it("sums fixed weights and returns the contributing breakdown", () => {
    const result = scoreOpportunity([
      { source: "existing_customer_link" },
      { source: "referral" },
    ]);
    expect(result.score).toBe(55);
    expect(result.breakdown).toEqual([
      { source: "existing_customer_link", weight: 30 },
      { source: "referral", weight: 25 },
    ]);
  });

  it("caps the total at MAX_OPPORTUNITY_SCORE", () => {
    const result = scoreOpportunity([
      { source: "existing_customer_link" },
      { source: "referral" },
      { source: "inbound_enquiry" },
      { source: "event" },
      { source: "staff_observation" },
    ]);
    expect(result.score).toBe(MAX_OPPORTUNITY_SCORE);
  });

  it("scores zero signals as zero, not a default", () => {
    expect(scoreOpportunity([]).score).toBe(0);
  });
});

describe("checkCreateOpportunity", () => {
  it("refuses a blank company name", () => {
    expect(checkCreateOpportunity({ companyName: "   " })).toEqual({
      ok: false,
      reason: "company_name_required",
    });
  });

  it("accepts a real company name", () => {
    expect(
      checkCreateOpportunity({ companyName: "Acme Tailoring Ltd" }),
    ).toEqual({ ok: true });
  });
});

describe("checkAddSignal", () => {
  it("refuses a blank detail", () => {
    expect(checkAddSignal({ detail: "" })).toEqual({
      ok: false,
      reason: "detail_required",
    });
  });

  it("accepts a real detail", () => {
    expect(
      checkAddSignal({ detail: "Met their ops lead at a trade show" }),
    ).toEqual({ ok: true });
  });

  it("refuses a public_signal with no citation", () => {
    expect(
      checkAddSignal({
        detail: "Press release mentions expansion",
        source: "public_signal",
      }),
    ).toEqual({ ok: false, reason: "citation_required" });
  });

  it("refuses a public_signal with a non-URL citation", () => {
    expect(
      checkAddSignal({
        detail: "Press release mentions expansion",
        source: "public_signal",
        citationUrl: "saw it somewhere",
      }),
    ).toEqual({ ok: false, reason: "citation_required" });
  });

  it("accepts a public_signal with a real checkable citation", () => {
    expect(
      checkAddSignal({
        detail: "Press release mentions expansion",
        source: "public_signal",
        citationUrl: "https://example.com/press/expansion",
      }),
    ).toEqual({ ok: true });
  });

  it("never requires a citation for a non-public_signal source", () => {
    expect(
      checkAddSignal({ detail: "Referred by a client", source: "referral" }),
    ).toEqual({ ok: true });
  });
});
