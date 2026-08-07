import { describe, expect, it } from "vitest";

import { checkCaptureBundleProposal } from "./advisor-capture";

const rawText =
  "Mr Brown came in looking for black shoes, prefers oxfords. Promised to call him Friday when the new linen jackets arrive.";

describe("checkCaptureBundleProposal", () => {
  it("accepts a self-portrait fact whose excerpt is really in the note", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "self_portrait_fact",
          summary: "Prefers black oxford shoes",
          sourceExcerpt: "looking for black shoes, prefers oxfords",
          confidence: 0.9,
          payload: { factType: "colour_interest", valueLabel: "Black shoes" },
        },
      }),
    ).toEqual({ ok: true });
  });

  it("refuses an excerpt the AI invented rather than quoted", () => {
    // The exact failure mode citing evidence exists to catch: a plausible
    // restatement is not the same as a real quote from the source text.
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "self_portrait_fact",
          summary: "Prefers brown loafers",
          sourceExcerpt: "customer really loves brown loafers",
          confidence: 0.9,
          payload: { factType: "colour_interest", valueLabel: "Brown loafers" },
        },
      }),
    ).toEqual({ ok: false, reason: "source_excerpt_not_in_note" });
  });

  it("refuses a self-portrait fact with an unknown fact type", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "self_portrait_fact",
          summary: "x",
          sourceExcerpt: "black shoes",
          confidence: 0.5,
          payload: {
            factType: "not_a_real_type" as never,
            valueLabel: "x",
          },
        },
      }),
    ).toEqual({ ok: false, reason: "self_portrait_fact_type_required" });
  });

  it("refuses a follow-up with no suggested action", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "follow_up",
          summary: "Call about linen jackets",
          sourceExcerpt: "Promised to call him Friday",
          confidence: 0.8,
          payload: { whyNow: "Promised a Friday call", suggestedAction: "" },
        },
      }),
    ).toEqual({ ok: false, reason: "follow_up_suggested_action_required" });
  });

  it("accepts a valid follow-up", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "follow_up",
          summary: "Call Mr Brown when linen jackets arrive",
          sourceExcerpt:
            "Promised to call him Friday when the new linen jackets arrive",
          confidence: 0.85,
          payload: {
            whyNow: "Promised a call once new stock arrives",
            suggestedAction: "Call Mr Brown about the new linen jackets",
            channel: "phone",
          },
        },
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a task note with no text", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "task_note",
          summary: "x",
          sourceExcerpt: "black shoes",
          confidence: 0.5,
          payload: { note: "  " },
        },
      }),
    ).toEqual({ ok: false, reason: "task_note_required" });
  });

  it("refuses an out-of-range confidence", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "task_note",
          summary: "x",
          sourceExcerpt: "black shoes",
          confidence: 1.5,
          payload: { note: "note" },
        },
      }),
    ).toEqual({ ok: false, reason: "confidence_out_of_range" });
  });

  it("refuses an empty summary or excerpt", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "task_note",
          summary: "  ",
          sourceExcerpt: "black shoes",
          confidence: 0.5,
          payload: { note: "note" },
        },
      }),
    ).toEqual({ ok: false, reason: "summary_required" });
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "task_note",
          summary: "x",
          sourceExcerpt: "  ",
          confidence: 0.5,
          payload: { note: "note" },
        },
      }),
    ).toEqual({ ok: false, reason: "source_excerpt_required" });
  });

  it("accepts a valid appointment proposal with a resolved date", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "appointment_proposal",
          summary: "Book a fitting for Mr Brown",
          sourceExcerpt: "Promised to call him Friday",
          confidence: 0.7,
          payload: {
            appointmentType: "fitting",
            startsAt: "2026-08-14T10:00:00.000Z",
            durationMinutes: 45,
            reason:
              "Promised to call him Friday when the new linen jackets arrive",
          },
        },
      }),
    ).toEqual({ ok: true });
  });

  it("refuses an appointment proposal with an unresolvable date rather than inventing one", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "appointment_proposal",
          summary: "Book a fitting",
          sourceExcerpt: "Promised to call him Friday",
          confidence: 0.7,
          payload: {
            appointmentType: "fitting",
            startsAt: "next Tuesday",
            durationMinutes: 45,
            reason: "unclear",
          },
        },
      }),
    ).toEqual({ ok: false, reason: "appointment_starts_at_invalid" });
  });

  it("refuses an appointment proposal with an unknown type", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "appointment_proposal",
          summary: "Book something",
          sourceExcerpt: "black shoes",
          confidence: 0.5,
          payload: {
            appointmentType: "not_a_real_type" as never,
            startsAt: "2026-08-14T10:00:00.000Z",
            durationMinutes: 45,
            reason: "reason",
          },
        },
      }),
    ).toEqual({ ok: false, reason: "appointment_type_required" });
  });

  it("refuses an appointment proposal with a nonsensical duration", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "appointment_proposal",
          summary: "Book a fitting",
          sourceExcerpt: "black shoes",
          confidence: 0.5,
          payload: {
            appointmentType: "fitting",
            startsAt: "2026-08-14T10:00:00.000Z",
            durationMinutes: 0,
            reason: "reason",
          },
        },
      }),
    ).toEqual({ ok: false, reason: "appointment_duration_invalid" });
  });

  it("accepts an unresolved item with a question", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "unresolved",
          summary: "Unclear which jacket was meant",
          sourceExcerpt: "black shoes",
          confidence: 0.4,
          payload: { question: "Which jacket did the customer mean?" },
        },
      }),
    ).toEqual({ ok: true });
  });

  it("refuses an unresolved item with no question", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "unresolved",
          summary: "x",
          sourceExcerpt: "black shoes",
          confidence: 0.4,
          payload: { question: "  " },
        },
      }),
    ).toEqual({ ok: false, reason: "unresolved_question_required" });
  });
});
