import { describe, expect, it } from "vitest";

import {
  assessPartnerSla,
  buildPartnerJobView,
  checkCustodyTransition,
  checkInvoiceApproval,
  PARTNER_CUSTODY_SPLIT_NOTE,
  reconcilePartnerInvoice,
  selectPartner,
  type ServicePartner,
} from "./partner-network";

const partners: ServicePartner[] = [
  {
    partnerId: "p-fast",
    displayName: "Kwik Press",
    branchId: "amsterdam",
    capabilities: ["dry_cleaning", "alteration"],
    turnaroundDays: 2,
    active: true,
  },
  {
    partnerId: "p-slow",
    displayName: "Atelier Bernard",
    capabilities: ["alteration", "invisible_mending"],
    turnaroundDays: 9,
    active: true,
  },
  {
    partnerId: "p-off",
    displayName: "Closed Cobbler",
    capabilities: ["shoe_repair"],
    turnaroundDays: 1,
    active: false,
  },
];

describe("selectPartner", () => {
  it("prefers the fastest capable partner", () => {
    const result = selectPartner({
      partners,
      capability: "alteration",
      requestedOn: "2026-08-01",
    });
    expect(result).toMatchObject({ ok: true, partnerId: "p-fast" });
  });

  it("distinguishes 'nobody does this' from 'nobody can make the date'", () => {
    // These lead a manager to completely different actions, so they are
    // not collapsed into one "unavailable".
    expect(
      selectPartner({
        partners,
        capability: "leather_care",
        requestedOn: "2026-08-01",
      }),
    ).toEqual({ ok: false, reason: "no_partner_with_capability" });

    expect(
      selectPartner({
        partners,
        capability: "invisible_mending",
        requestedOn: "2026-08-01",
        neededBy: "2026-08-03",
      }),
    ).toEqual({ ok: false, reason: "no_partner_meets_deadline" });
  });

  it("ignores an inactive partner even when it is the only capable one", () => {
    expect(
      selectPartner({
        partners,
        capability: "shoe_repair",
        requestedOn: "2026-08-01",
      }),
    ).toEqual({ ok: false, reason: "no_partner_with_capability" });
  });

  it("treats a partner with no branch as available everywhere", () => {
    // A courier round-trip to another city is different economics, so
    // branch-pinned partners are filtered — but an unpinned one is not.
    const result = selectPartner({
      partners,
      capability: "invisible_mending",
      branchId: "rotterdam",
      requestedOn: "2026-08-01",
    });
    expect(result).toMatchObject({ ok: true, partnerId: "p-slow" });
  });

  it("excludes a partner pinned to a different branch", () => {
    const result = selectPartner({
      partners,
      capability: "dry_cleaning",
      branchId: "rotterdam",
      requestedOn: "2026-08-01",
    });
    expect(result).toEqual({ ok: false, reason: "no_partner_at_branch" });
  });

  it("says why it chose who it chose", () => {
    const result = selectPartner({
      partners,
      capability: "alteration",
      requestedOn: "2026-08-01",
      neededBy: "2026-08-06",
    });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("unreachable");
    expect(result.rationale).toContain("2d turnaround");
    expect(result.rationale).toContain("5d available");
  });
});

describe("checkCustodyTransition", () => {
  it("refuses to release a garment that is still at the partner", () => {
    // This is how a garment gets marked collected while sitting on a rail
    // across town.
    expect(
      checkCustodyTransition({
        from: "with_partner",
        to: "released_to_customer",
      }),
    ).toEqual({ ok: false, reason: "release_requires_return" });
  });

  it("requires a condition note on the return leg", () => {
    // The moment it comes back is the only moment damage can be
    // attributed. Without it every later dispute is a stalemate.
    expect(
      checkCustodyTransition({
        from: "in_transit_to_retailer",
        to: "returned_to_retailer",
      }),
    ).toEqual({ ok: false, reason: "condition_note_required" });
    expect(
      checkCustodyTransition({
        from: "in_transit_to_retailer",
        to: "returned_to_retailer",
        conditionNote: "Pressed, no marks, button intact.",
      }),
    ).toEqual({ ok: true });
  });

  it("allows a failed collection to bounce back", () => {
    expect(
      checkCustodyTransition({
        from: "in_transit_to_partner",
        to: "with_retailer",
      }),
    ).toEqual({ ok: true });
  });

  it("allows a re-send after an unsatisfactory return", () => {
    expect(
      checkCustodyTransition({
        from: "returned_to_retailer",
        to: "in_transit_to_partner",
      }),
    ).toEqual({ ok: true });
  });

  it("has no transition out of released", () => {
    expect(
      checkCustodyTransition({
        from: "released_to_customer",
        to: "with_retailer",
      }),
    ).toEqual({ ok: false, reason: "transition_not_allowed" });
  });
});

describe("buildPartnerJobView", () => {
  it("gives a partner no customer name and no address", () => {
    const view = buildPartnerJobView({
      jobReference: "JOB-991",
      capability: "dry_cleaning",
      garmentDescription: "Navy wool two-piece",
      instructions: "No steam on the lapel.",
      dueOn: "2026-08-06",
      customerFullName: "Alexander van Doorn",
      customerAddress: "Keizersgracht 1, Amsterdam",
    });
    expect(Object.keys(view)).toEqual([
      "jobReference",
      "capability",
      "garmentDescription",
      "instructions",
      "dueOn",
    ]);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("Alexander");
    expect(serialized).not.toContain("Keizersgracht");
  });
});

describe("assessPartnerSla", () => {
  it("computes the promised date from the send date and turnaround", () => {
    const sla = assessPartnerSla({
      sentOn: "2026-08-01T00:00:00.000Z",
      turnaroundDays: 3,
      asOf: "2026-08-03T00:00:00.000Z",
    });
    expect(sla.promisedOn).toBe("2026-08-04");
    expect(sla.breached).toBe(false);
  });

  it("reports a breach against the actual return, not against now", () => {
    const sla = assessPartnerSla({
      sentOn: "2026-08-01T00:00:00.000Z",
      turnaroundDays: 3,
      returnedOn: "2026-08-06T00:00:00.000Z",
      asOf: "2026-09-01T00:00:00.000Z",
    });
    expect(sla.breached).toBe(true);
    expect(sla.daysLate).toBe(2);
  });

  it("never reports negative lateness for an early return", () => {
    const sla = assessPartnerSla({
      sentOn: "2026-08-01T00:00:00.000Z",
      turnaroundDays: 5,
      returnedOn: "2026-08-02T00:00:00.000Z",
      asOf: "2026-08-02T00:00:00.000Z",
    });
    expect(sla.daysLate).toBe(0);
  });
});

describe("reconcilePartnerInvoice", () => {
  const recordedCosts = [
    { jobReference: "JOB-1", amountMinorUnits: 2500 },
    { jobReference: "JOB-2", amountMinorUnits: 4000 },
  ];

  it("reconciles an exact invoice", () => {
    const result = reconcilePartnerInvoice({
      invoiceLines: recordedCosts,
      recordedCosts,
    });
    expect(result.reconciled).toBe(true);
    expect(result.matched).toEqual(["JOB-1", "JOB-2"]);
  });

  it("catches a line billed for work we never recorded", () => {
    const result = reconcilePartnerInvoice({
      invoiceLines: [
        ...recordedCosts,
        { jobReference: "JOB-GHOST", amountMinorUnits: 9900 },
      ],
      recordedCosts,
    });
    expect(result.unmatchedInvoiceLines).toEqual(["JOB-GHOST"]);
    expect(result.reconciled).toBe(false);
  });

  it("catches work we recorded that never appeared on the invoice", () => {
    const result = reconcilePartnerInvoice({
      invoiceLines: [recordedCosts[0]!],
      recordedCosts,
    });
    expect(result.uninvoicedCosts).toEqual(["JOB-2"]);
    expect(result.reconciled).toBe(false);
  });

  it("reports an amount variance with its direction", () => {
    const result = reconcilePartnerInvoice({
      invoiceLines: [
        { jobReference: "JOB-1", amountMinorUnits: 3000 },
        { jobReference: "JOB-2", amountMinorUnits: 4000 },
      ],
      recordedCosts,
    });
    expect(result.amountVariances).toEqual([
      {
        jobReference: "JOB-1",
        recordedMinorUnits: 2500,
        invoicedMinorUnits: 3000,
        varianceMinorUnits: 500,
      },
    ]);
    expect(result.reconciled).toBe(false);
  });

  it("is not 'mostly reconciled' — any discrepancy fails the whole invoice", () => {
    // An invoice that mostly matches is an invoice nobody actually checked.
    const result = reconcilePartnerInvoice({
      invoiceLines: [
        { jobReference: "JOB-1", amountMinorUnits: 2500 },
        { jobReference: "JOB-2", amountMinorUnits: 4001 },
      ],
      recordedCosts,
    });
    expect(result.matched).toHaveLength(2);
    expect(result.reconciled).toBe(false);
  });
});

describe("checkInvoiceApproval", () => {
  const reconciled = reconcilePartnerInvoice({
    invoiceLines: [{ jobReference: "JOB-1", amountMinorUnits: 2500 }],
    recordedCosts: [{ jobReference: "JOB-1", amountMinorUnits: 2500 }],
  });

  it("approves a reconciled invoice signed by someone else", () => {
    expect(
      checkInvoiceApproval({
        reconciliation: reconciled,
        submittedByStaffId: "a",
        approverStaffId: "b",
      }),
    ).toEqual({ ok: true });
  });

  it("refuses to approve an unreconciled invoice", () => {
    expect(
      checkInvoiceApproval({
        reconciliation: { ...reconciled, reconciled: false },
        submittedByStaffId: "a",
        approverStaffId: "b",
      }),
    ).toEqual({ ok: false, reason: "not_reconciled" });
  });

  it("refuses self-approval", () => {
    expect(
      checkInvoiceApproval({
        reconciliation: reconciled,
        submittedByStaffId: "a",
        approverStaffId: "a",
      }),
    ).toEqual({ ok: false, reason: "self_approval_not_allowed" });
  });

  it("refuses a payout outright rather than silently ignoring the flag", () => {
    // "No partner payout without approved money design" — ADR-062 has not
    // made that decision. Ignoring the flag would let a caller believe
    // money moved.
    expect(
      checkInvoiceApproval({
        reconciliation: reconciled,
        submittedByStaffId: "a",
        approverStaffId: "b",
        initiatePayout: true,
      }),
    ).toEqual({ ok: false, reason: "payout_not_designed" });
  });
});

describe("custody boundary", () => {
  it("states in code why partner custody is a separate table", () => {
    expect(PARTNER_CUSTODY_SPLIT_NOTE).toContain("chain_of_custody_events");
    expect(PARTNER_CUSTODY_SPLIT_NOTE).toContain("never the same garment");
  });
});
