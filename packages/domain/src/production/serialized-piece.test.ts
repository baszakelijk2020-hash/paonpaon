import { describe, expect, it } from "vitest";

import { GARMENT_CATEGORIES } from "./production";
import {
  assessDelay,
  buildOutworkerTicket,
  buildPieceBarcode,
  checkOrderDispatch,
  checkSpecChange,
  checkStageTransition,
  parsePieceBarcode,
  PIECE_KINDS,
  reconcileMaterials,
} from "./serialized-piece";

describe("piece vocabulary", () => {
  it("keeps every piece kind a real garment category", () => {
    // Two vocabularies for "what is a jacket" would eventually disagree.
    // PIECE_KINDS is a strict subset: a suit is a garment category but not
    // a separable piece.
    for (const kind of PIECE_KINDS) {
      expect(GARMENT_CATEGORIES).toContain(kind);
    }
    expect(GARMENT_CATEGORIES).toContain("suit");
    expect(PIECE_KINDS as readonly string[]).not.toContain("suit");
  });
});

describe("checkStageTransition", () => {
  it("allows the normal path forward", () => {
    expect(
      checkStageTransition({ from: "spec_locked", to: "cutting" }),
    ).toEqual({ ok: true });
    expect(checkStageTransition({ from: "cutting", to: "assembly" })).toEqual({
      ok: true,
    });
  });

  it("refuses a jump that skips work", () => {
    expect(checkStageTransition({ from: "cutting", to: "ready" })).toEqual({
      ok: false,
      reason: "transition_not_allowed",
    });
  });

  it("sends rework back to assembly rather than resuming where it failed", () => {
    // Something has to be undone. Resuming exactly where a QC failure
    // happened is how a failed piece gets marked ready untouched.
    expect(
      checkStageTransition({
        from: "quality_control",
        to: "rework",
        defectNote: "Left shoulder sits 4mm high.",
        inspectorStaffId: "qc-1",
        makerStaffId: "maker-1",
      }),
    ).toEqual({ ok: true });
    expect(checkStageTransition({ from: "rework", to: "ready" })).toEqual({
      ok: false,
      reason: "transition_not_allowed",
    });
    expect(checkStageTransition({ from: "rework", to: "assembly" })).toEqual({
      ok: true,
    });
  });

  it("refuses a rework with no stated defect", () => {
    expect(
      checkStageTransition({
        from: "quality_control",
        to: "rework",
        inspectorStaffId: "qc-1",
        makerStaffId: "maker-1",
      }),
    ).toEqual({ ok: false, reason: "rework_requires_defect" });
  });

  it("refuses someone signing off their own work", () => {
    // Inspecting your own piece is self-assessment, not quality control.
    expect(
      checkStageTransition({
        from: "quality_control",
        to: "ready",
        inspectorStaffId: "maker-1",
        makerStaffId: "maker-1",
      }),
    ).toEqual({ ok: false, reason: "inspector_cannot_be_maker" });
  });

  it("refuses a QC exit with no named inspector", () => {
    expect(
      checkStageTransition({ from: "quality_control", to: "ready" }),
    ).toEqual({ ok: false, reason: "quality_control_requires_inspector" });
  });

  it("has no transition out of dispatched", () => {
    expect(checkStageTransition({ from: "dispatched", to: "rework" })).toEqual({
      ok: false,
      reason: "transition_not_allowed",
    });
  });
});

describe("checkOrderDispatch", () => {
  it("refuses to dispatch a suit whose jacket is still in rework", () => {
    // The exact state an order-level status cannot represent without lying
    // about one of the two pieces.
    expect(checkOrderDispatch({ pieceStages: ["ready", "rework"] })).toEqual({
      ok: false,
      reason: "dispatch_requires_all_pieces_ready",
    });
  });

  it("dispatches when every piece is ready", () => {
    expect(checkOrderDispatch({ pieceStages: ["ready", "ready"] })).toEqual({
      ok: true,
    });
  });
});

describe("piece barcodes", () => {
  it("round-trips a built barcode", () => {
    const barcode = buildPieceBarcode({
      retailerCode: "MUN",
      orderNumber: "ORD-1042",
      pieceKind: "trousers",
      pieceSequence: 2,
    });
    expect(barcode).toBe("MUN-ORD-1042-TRO02");
    const parsed = parsePieceBarcode(barcode);
    expect(parsed).toEqual({
      ok: true,
      retailerCode: "MUN",
      orderNumber: "ORD-1042",
      pieceKindPrefix: "TRO",
      pieceSequence: 2,
    });
  });

  it("distinguishes a jacket from trousers on the same order", () => {
    // "Jacket/trousers scan independently" is the acceptance criterion.
    const jacket = buildPieceBarcode({
      retailerCode: "MUN",
      orderNumber: "ORD-1042",
      pieceKind: "jacket",
      pieceSequence: 1,
    });
    const trousers = buildPieceBarcode({
      retailerCode: "MUN",
      orderNumber: "ORD-1042",
      pieceKind: "trousers",
      pieceSequence: 2,
    });
    expect(jacket).not.toBe(trousers);
  });

  it("rejects a malformed scan instead of guessing", () => {
    expect(parsePieceBarcode("not a barcode")).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(parsePieceBarcode("MUN-ORD-1042-TRO")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});

describe("checkSpecChange", () => {
  it("allows an ordinary edit before anything is cut", () => {
    expect(checkSpecChange({ stage: "spec_locked" })).toEqual({
      ok: true,
      requiresAmendment: false,
    });
  });

  it("turns a post-cut change into an explicit amendment", () => {
    // Silently editing the spec leaves the cut cloth and the record
    // disagreeing, with nothing recording that anyone knew.
    expect(
      checkSpecChange({
        stage: "assembly",
        reason: "Client asked for a ticket pocket after the basted fitting.",
        costDecision: "customer_pays",
      }),
    ).toEqual({ ok: true, requiresAmendment: true });
  });

  it("refuses an amendment with no reason or no cost decision", () => {
    expect(checkSpecChange({ stage: "assembly" })).toEqual({
      ok: false,
      reason: "amendment_requires_reason",
    });
    expect(
      checkSpecChange({ stage: "assembly", reason: "Client changed mind" }),
    ).toEqual({ ok: false, reason: "amendment_requires_cost_decision" });
  });

  it("refuses any change once dispatched", () => {
    expect(
      checkSpecChange({
        stage: "dispatched",
        reason: "x",
        costDecision: "retailer_absorbs",
      }),
    ).toEqual({ ok: false, reason: "spec_immutable_after_cut" });
  });
});

describe("reconcileMaterials", () => {
  it("reports under-consumption as well as over-consumption", () => {
    // Under-consumption usually means the BOM is wrong, which quietly
    // mis-costs every future garment of that pattern.
    const result = reconcileMaterials([
      {
        materialKey: "cloth",
        plannedUnits: 3.4,
        consumedUnits: 3.6,
        unit: "metre",
      },
      {
        materialKey: "lining",
        plannedUnits: 2,
        consumedUnits: 1.5,
        unit: "metre",
      },
      {
        materialKey: "buttons",
        plannedUnits: 11,
        consumedUnits: 11,
        unit: "piece",
      },
    ]);
    expect(result).toEqual([
      { materialKey: "cloth", varianceUnits: 0.2, overConsumed: true },
      { materialKey: "lining", varianceUnits: -0.5, overConsumed: false },
    ]);
  });

  it("does not emit floating-point noise for an exact match", () => {
    const result = reconcileMaterials([
      {
        materialKey: "cloth",
        plannedUnits: 0.1 + 0.2,
        consumedUnits: 0.3,
        unit: "metre",
      },
    ]);
    expect(result).toEqual([]);
  });
});

describe("buildOutworkerTicket", () => {
  it("gives an outworker initials, never a customer name", () => {
    const ticket = buildOutworkerTicket({
      barcode: "MUN-ORD-1042-JAC01",
      pieceKind: "jacket",
      stage: "assembly",
      instructions: "Pad-stitch the lapel by hand.",
      dueOn: "2026-08-20",
      customerFullName: "Alexander van Doorn",
    });
    expect(ticket.customerInitials).toBe("AVD");
    // Whitelist, not redaction: a redaction pass fails open when a new
    // field is added later. This object simply has nowhere to put one.
    expect(Object.keys(ticket)).toEqual([
      "barcode",
      "pieceKind",
      "stage",
      "instructions",
      "dueOn",
      "customerInitials",
    ]);
    expect(JSON.stringify(ticket)).not.toContain("Alexander");
  });
});

describe("assessDelay", () => {
  it("reports no delay before the promised date", () => {
    expect(
      assessDelay({ promisedOn: "2026-08-20", asOf: "2026-08-18" }),
    ).toEqual({ delayed: false, daysLate: 0, requiresServiceRecovery: false });
  });

  it("escalates a delay past the threshold to service recovery", () => {
    expect(
      assessDelay({ promisedOn: "2026-08-20", asOf: "2026-08-24" }),
    ).toEqual({ delayed: true, daysLate: 4, requiresServiceRecovery: true });
  });

  it("treats a one-day slip as a delay but not yet a recovery event", () => {
    expect(
      assessDelay({ promisedOn: "2026-08-20", asOf: "2026-08-21" }),
    ).toEqual({ delayed: true, daysLate: 1, requiresServiceRecovery: false });
  });

  it("measures against completion when the piece finished late", () => {
    expect(
      assessDelay({
        promisedOn: "2026-08-20",
        asOf: "2026-09-30",
        completedOn: "2026-08-22",
      }),
    ).toEqual({ delayed: true, daysLate: 2, requiresServiceRecovery: false });
  });
});
