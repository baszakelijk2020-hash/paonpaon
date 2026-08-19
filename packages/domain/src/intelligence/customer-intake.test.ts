import { describe, expect, it } from "vitest";

import {
  checkCustomerIntakeProposal,
  type CustomerIntakeProposal,
} from "./customer-intake";

const RAW_TEXT =
  "I love navy blazers and prefer classic fits. Our anniversary is June 12th. I travel for work most of March.";

function proposal(
  overrides: Partial<CustomerIntakeProposal>,
): CustomerIntakeProposal {
  return {
    factType: "colour_interest",
    valueLabel: "Navy",
    sourceExcerpt: "navy blazers",
    confidence: 0.9,
    ...overrides,
  };
}

describe("checkCustomerIntakeProposal", () => {
  it("accepts a proposal whose excerpt is a real substring of the intake text", () => {
    expect(
      checkCustomerIntakeProposal({
        rawIntakeText: RAW_TEXT,
        proposal: proposal({}),
      }),
    ).toEqual({ ok: true });
  });

  it("is case-insensitive when matching the excerpt", () => {
    expect(
      checkCustomerIntakeProposal({
        rawIntakeText: RAW_TEXT,
        proposal: proposal({ sourceExcerpt: "NAVY BLAZERS" }),
      }),
    ).toEqual({ ok: true });
  });

  it("refuses an excerpt that is not actually in the intake text — the AI restating its own conclusion, not quoting", () => {
    expect(
      checkCustomerIntakeProposal({
        rawIntakeText: RAW_TEXT,
        proposal: proposal({ sourceExcerpt: "loves the color blue" }),
      }),
    ).toEqual({ ok: false, reason: "source_excerpt_not_in_intake_text" });
  });

  it("refuses a blank value label", () => {
    expect(
      checkCustomerIntakeProposal({
        rawIntakeText: RAW_TEXT,
        proposal: proposal({ valueLabel: "  " }),
      }),
    ).toEqual({ ok: false, reason: "value_label_required" });
  });

  it("refuses a blank source excerpt", () => {
    expect(
      checkCustomerIntakeProposal({
        rawIntakeText: RAW_TEXT,
        proposal: proposal({ sourceExcerpt: "  " }),
      }),
    ).toEqual({ ok: false, reason: "source_excerpt_required" });
  });

  it("refuses confidence below 0", () => {
    expect(
      checkCustomerIntakeProposal({
        rawIntakeText: RAW_TEXT,
        proposal: proposal({ confidence: -0.1 }),
      }),
    ).toEqual({ ok: false, reason: "invalid_confidence" });
  });

  it("refuses confidence above 1", () => {
    expect(
      checkCustomerIntakeProposal({
        rawIntakeText: RAW_TEXT,
        proposal: proposal({ confidence: 1.1 }),
      }),
    ).toEqual({ ok: false, reason: "invalid_confidence" });
  });

  it("refuses non-finite confidence", () => {
    expect(
      checkCustomerIntakeProposal({
        rawIntakeText: RAW_TEXT,
        proposal: proposal({ confidence: Number.NaN }),
      }),
    ).toEqual({ ok: false, reason: "invalid_confidence" });
  });

  it("refuses a fact type outside the intake-safe subset (e.g. employer, declared-only elsewhere but not intake-extractable)", () => {
    expect(
      checkCustomerIntakeProposal({
        rawIntakeText: RAW_TEXT,
        proposal: {
          ...proposal({}),
          // employer is a real CustomerFactType but not a
          // CustomerIntakeFactType -- cast to exercise the runtime guard
          // the same way an untyped AI response would hit it.
          factType: "employer" as CustomerIntakeProposal["factType"],
        },
      }),
    ).toEqual({ ok: false, reason: "unsupported_fact_type" });
  });

  it("accepts each real occasion/date fact grounded in the text", () => {
    expect(
      checkCustomerIntakeProposal({
        rawIntakeText: RAW_TEXT,
        proposal: proposal({
          factType: "anniversary",
          valueLabel: "June 12",
          sourceExcerpt: "anniversary is June 12th",
        }),
      }),
    ).toEqual({ ok: true });

    expect(
      checkCustomerIntakeProposal({
        rawIntakeText: RAW_TEXT,
        proposal: proposal({
          factType: "travel_window",
          valueLabel: "March",
          sourceExcerpt: "travel for work most of March",
        }),
      }),
    ).toEqual({ ok: true });
  });
});
