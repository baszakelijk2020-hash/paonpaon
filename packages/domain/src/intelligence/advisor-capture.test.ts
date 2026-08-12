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

  it("accepts a valid appointment", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "appointment",
          summary: "Book a fitting Friday at 2pm",
          sourceExcerpt: "Promised to call him Friday",
          confidence: 0.75,
          payload: {
            appointmentType: "fitting",
            startsAt: "2026-08-14T14:00:00.000Z",
            endsAt: "2026-08-14T15:00:00.000Z",
          },
        },
      }),
    ).toEqual({ ok: true });
  });

  it("refuses an appointment with an unknown type", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "appointment",
          summary: "x",
          sourceExcerpt: "black shoes",
          confidence: 0.5,
          payload: {
            appointmentType: "not_a_real_type" as never,
            startsAt: "2026-08-14T14:00:00.000Z",
            endsAt: "2026-08-14T15:00:00.000Z",
          },
        },
      }),
    ).toEqual({ ok: false, reason: "appointment_type_required" });
  });

  it("refuses an appointment whose end is not after its start", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "appointment",
          summary: "x",
          sourceExcerpt: "black shoes",
          confidence: 0.5,
          payload: {
            appointmentType: "fitting",
            startsAt: "2026-08-14T15:00:00.000Z",
            endsAt: "2026-08-14T14:00:00.000Z",
          },
        },
      }),
    ).toEqual({ ok: false, reason: "appointment_time_range_invalid" });
  });

  it("accepts a valid care booking", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "care_booking",
          summary: "Press the new linen jackets",
          sourceExcerpt: "Promised to call him Friday",
          confidence: 0.7,
          payload: { bookingKind: "pressing" },
        },
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a care booking with an unknown booking kind", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "care_booking",
          summary: "x",
          sourceExcerpt: "black shoes",
          confidence: 0.5,
          payload: { bookingKind: "not_a_real_kind" as never },
        },
      }),
    ).toEqual({ ok: false, reason: "care_booking_kind_required" });
  });

  it("refuses a care booking with an unparseable requestedFor", () => {
    expect(
      checkCaptureBundleProposal({
        rawText,
        proposal: {
          kind: "care_booking",
          summary: "x",
          sourceExcerpt: "black shoes",
          confidence: 0.5,
          payload: { bookingKind: "cleaning", requestedFor: "not-a-date" },
        },
      }),
    ).toEqual({ ok: false, reason: "care_booking_requested_for_invalid" });
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
});
