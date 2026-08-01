import { describe, expect, it } from "vitest";

import {
  checkComplaintTransition,
  checkFabricButtonPairing,
  checkSupplyException,
  describeFactoryWriteBack,
  resolveSupplierFact,
  type SupplierFact,
} from "./supplier-intelligence";

const registered = ["mill_a_feed", "agent_b_portal"];

function fact(overrides: Partial<SupplierFact> = {}): SupplierFact {
  return {
    kind: "material_availability",
    supplierKey: "mill-a",
    materialKey: "cloth-4412",
    value: "in_stock",
    sourceAuthorityKey: "mill_a_feed",
    observedAt: "2026-08-01T00:00:00.000Z",
    sourceVersion: "feed-2026-08-01",
    ...overrides,
  };
}

describe("resolveSupplierFact", () => {
  it("resolves a fresh fact from a registered authority", () => {
    const result = resolveSupplierFact({
      facts: [fact()],
      kind: "material_availability",
      materialKey: "cloth-4412",
      registeredAuthorityKeys: registered,
      asOf: "2026-08-01T06:00:00.000Z",
    });
    expect(result).toMatchObject({ ok: true, stale: false });
  });

  it("refuses a fact from an unregistered source", () => {
    // "Someone emailed us a spreadsheet" is not a source. Treating it as
    // one is precisely the invented supplier data the non-goal forbids.
    const result = resolveSupplierFact({
      facts: [fact({ sourceAuthorityKey: "someones_spreadsheet" })],
      kind: "material_availability",
      materialKey: "cloth-4412",
      registeredAuthorityKeys: registered,
      asOf: "2026-08-01T06:00:00.000Z",
    });
    expect(result).toEqual({ ok: false, reason: "unknown_authority" });
  });

  it("surfaces a conflict instead of preferring the newer authority", () => {
    // Which supplier is right is a human question with commercial
    // consequences. Silently picking one hides it.
    const result = resolveSupplierFact({
      facts: [
        fact({ value: "in_stock", observedAt: "2026-07-30T00:00:00.000Z" }),
        fact({
          value: "out_of_stock",
          sourceAuthorityKey: "agent_b_portal",
          observedAt: "2026-08-01T00:00:00.000Z",
        }),
      ],
      kind: "material_availability",
      materialKey: "cloth-4412",
      registeredAuthorityKeys: registered,
      asOf: "2026-08-01T06:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("authority_conflict");
    expect(result.conflicting).toHaveLength(2);
  });

  it("does not call it a conflict when one authority simply updated itself", () => {
    const result = resolveSupplierFact({
      facts: [
        fact({ value: "in_stock", observedAt: "2026-07-30T00:00:00.000Z" }),
        fact({ value: "out_of_stock", observedAt: "2026-08-01T00:00:00.000Z" }),
      ],
      kind: "material_availability",
      materialKey: "cloth-4412",
      registeredAuthorityKeys: registered,
      asOf: "2026-08-01T06:00:00.000Z",
    });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("unreachable");
    expect(result.fact.value).toBe("out_of_stock");
  });

  it("flags a stale fact rather than presenting it as current", () => {
    const result = resolveSupplierFact({
      facts: [fact()],
      kind: "material_availability",
      materialKey: "cloth-4412",
      registeredAuthorityKeys: registered,
      asOf: "2026-08-10T00:00:00.000Z",
    });
    expect(result).toMatchObject({ ok: true, stale: true });
  });

  it("returns no_fact rather than inventing a default", () => {
    expect(
      resolveSupplierFact({
        facts: [],
        kind: "lead_time_days",
        materialKey: "cloth-9999",
        registeredAuthorityKeys: registered,
        asOf: "2026-08-01T00:00:00.000Z",
      }),
    ).toEqual({ ok: false, reason: "no_fact" });
  });
});

describe("checkFabricButtonPairing", () => {
  const rules = [
    {
      fabricKey: "flannel-grey",
      allowedButtonKeys: ["horn-dark", "corozo-charcoal"],
      note: "Avoid high-shine on a matte cloth.",
    },
  ];

  it("allows a documented pairing", () => {
    expect(
      checkFabricButtonPairing({
        rules,
        fabricKey: "flannel-grey",
        buttonKey: "horn-dark",
      }),
    ).toEqual({ ok: true });
  });

  it("refuses an undocumented pairing and says what is allowed", () => {
    const result = checkFabricButtonPairing({
      rules,
      fabricKey: "flannel-grey",
      buttonKey: "mother-of-pearl",
    });
    expect(result).toMatchObject({
      ok: false,
      reason: "pairing_not_allowed",
      note: "Avoid high-shine on a matte cloth.",
    });
  });

  it("treats a fabric with no rule as undecided, not as permitted", () => {
    // Defaulting to permissive turns silence into approval.
    expect(
      checkFabricButtonPairing({
        rules,
        fabricKey: "linen-oat",
        buttonKey: "anything",
      }),
    ).toEqual({ ok: false, reason: "no_rule_for_fabric" });
  });
});

describe("checkSupplyException", () => {
  const base = {
    kind: "material_shortage" as const,
    materialKey: "cloth-4412",
    ownerStaffId: "staff-1",
    detail: "Mill confirms 6 weeks; two open orders affected.",
    citations: [
      {
        sourceAuthorityKey: "mill_a_feed",
        sourceVersion: "feed-2026-08-01",
        observedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
  };

  it("accepts an owned, cited, described exception", () => {
    expect(checkSupplyException(base)).toEqual({ ok: true });
  });

  it("refuses an exception nobody owns", () => {
    // An unowned exception is a notification.
    expect(checkSupplyException({ ...base, ownerStaffId: " " })).toEqual({
      ok: false,
      reason: "owner_required",
    });
  });

  it("refuses an uncited exception", () => {
    // This is the black box the non-goal names directly.
    expect(checkSupplyException({ ...base, citations: [] })).toEqual({
      ok: false,
      reason: "citation_required",
    });
  });
});

describe("checkComplaintTransition", () => {
  it("walks the normal path", () => {
    expect(
      checkComplaintTransition({ from: "raised", to: "investigating" }),
    ).toEqual({ ok: true });
  });

  it("requires evidence before telling a supplier their work was defective", () => {
    // Without attaching what you saw, it is a claim rather than a case.
    expect(
      checkComplaintTransition({
        from: "investigating",
        to: "supplier_notified",
      }),
    ).toEqual({ ok: false, reason: "evidence_required" });
    expect(
      checkComplaintTransition({
        from: "investigating",
        to: "supplier_notified",
        evidenceRefs: ["photo-1", "qc-event-9"],
      }),
    ).toEqual({ ok: true });
  });

  it("refuses to close a case where the customer was never recovered", () => {
    // A supplier credit is not a resolution for the customer.
    expect(
      checkComplaintTransition({
        from: "supplier_notified",
        to: "closed",
        outcomeNote: "Supplier issued a credit.",
      }),
    ).toEqual({ ok: false, reason: "close_requires_customer_recovery" });
  });

  it("closes only with a stated outcome", () => {
    expect(
      checkComplaintTransition({ from: "customer_recovered", to: "closed" }),
    ).toEqual({ ok: false, reason: "close_requires_outcome" });
    expect(
      checkComplaintTransition({
        from: "customer_recovered",
        to: "closed",
        outcomeNote: "Remade at our cost; client collected and was happy.",
      }),
    ).toEqual({ ok: true });
  });

  it("allows recovering the customer without ever notifying a supplier", () => {
    // Sometimes it was our fault. The path must not force a supplier
    // accusation.
    expect(
      checkComplaintTransition({
        from: "investigating",
        to: "customer_recovered",
      }),
    ).toEqual({ ok: true });
  });
});

describe("describeFactoryWriteBack", () => {
  it("refuses rather than leaving a TODO for someone to fill in", () => {
    const result = describeFactoryWriteBack();
    expect(result.supported).toBe(false);
    expect(result.reason).toContain("No documented supplier write-back API");
  });
});
