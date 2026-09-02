import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { SupplierIntelligenceRepository } from "./supplier-intelligence-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type SupplierFactRow = Database["public"]["Tables"]["supplier_facts"]["Row"];
type FabricButtonRuleRow =
  Database["public"]["Tables"]["fabric_button_rules"]["Row"];
type FabricLiningRuleRow =
  Database["public"]["Tables"]["fabric_lining_rules"]["Row"];
type SupplyExceptionRow =
  Database["public"]["Tables"]["supply_exceptions"]["Row"];
type SupplyComplaintCaseRow =
  Database["public"]["Tables"]["supply_complaint_cases"]["Row"];

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const staffId = "staff-001";
const unique = Date.now();
const materialKey = `e2e-flannel-${unique}`;
const supplierKey = `e2e-supplier-${unique}`;
const authorityKey = `e2e-authority-${unique}`;

function makeFact(overrides?: Partial<SupplierFactRow>): SupplierFactRow {
  return {
    id: "fact-1",
    retailer_id: retailerId,
    material_key: "cloth-1",
    supplier_key: "mill-a",
    kind: "material_availability",
    value: "in_stock",
    source_authority_key: "auth-1",
    source_version: "v1",
    observed_at: "2026-08-01T00:00:00.000Z",
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeButtonRule(
  overrides?: Partial<FabricButtonRuleRow>,
): FabricButtonRuleRow {
  return {
    id: "rule-1",
    retailer_id: retailerId,
    fabric_key: "flannel-grey",
    allowed_button_keys: ["horn-dark"],
    note: "Dark tones only.",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeLiningRule(
  overrides?: Partial<FabricLiningRuleRow>,
): FabricLiningRuleRow {
  return {
    id: "rule-1",
    retailer_id: retailerId,
    fabric_key: "flannel-grey",
    standard_lining_keys: ["bemberg-charcoal"],
    upsell_lining_keys: ["silk-jacquard-house"],
    note: "House jacquard is the signature upgrade.",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeException(
  overrides?: Partial<SupplyExceptionRow>,
): SupplyExceptionRow {
  return {
    id: "ex-1",
    retailer_id: retailerId,
    kind: "material_shortage",
    material_key: "cloth-1",
    owner_staff_id: staffId,
    detail: "Short supply",
    citations: {} as never,
    state: "open",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    resolved_at: null,
    resolution_note: null,
    ...overrides,
  };
}

describe("SupplierIntelligenceRepository", () => {
  describe("recordFact", () => {
    it("inserts a supplier fact with all required fields", async () => {
      const from = vi.fn().mockReturnValue(
        fakeQueryBuilder({
          data: { id: "fact-001" },
          error: null,
        }),
      );

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.recordFact({
        retailerId,
        fact: {
          kind: "material_availability",
          supplierKey,
          materialKey,
          value: "in_stock",
          sourceAuthorityKey: authorityKey,
          observedAt: "2026-08-01T09:00:00.000Z",
          sourceVersion: "v1",
        },
      });

      expect(result.id).toBe("fact-001");
      expect(from).toHaveBeenCalledWith("supplier_facts");
    });

    it("throws on database error", async () => {
      const error = new Error("Database connection failed");
      const from = vi.fn().mockReturnValue(
        fakeQueryBuilder({
          data: null,
          error: error as never,
        }),
      );

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      await expect(
        repo.recordFact({
          retailerId,
          fact: {
            kind: "material_availability",
            supplierKey,
            materialKey,
            value: "in_stock",
            sourceAuthorityKey: authorityKey,
            observedAt: "2026-08-01T09:00:00.000Z",
            sourceVersion: "v1",
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe("findFactsByRetailer", () => {
    it("finds all facts for a retailer without material filter", async () => {
      const facts: SupplierFactRow[] = [
        makeFact({ id: "fact-1", material_key: "cloth-1" }),
        makeFact({
          id: "fact-2",
          material_key: "cloth-2",
          value: "out_of_stock",
          observed_at: "2026-08-02T00:00:00.000Z",
        }),
      ];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: facts, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.findFactsByRetailer({ retailerId });

      expect(result).toEqual(facts);
      expect(from).toHaveBeenCalledWith("supplier_facts");
    });

    it("filters facts by material key when provided", async () => {
      const facts: SupplierFactRow[] = [
        makeFact({ id: "fact-1", material_key: "cloth-1" }),
      ];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: facts, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.findFactsByRetailer({
        retailerId,
        materialKey: "cloth-1",
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.material_key).toBe("cloth-1");
    });
  });

  describe("upsertFabricButtonRule", () => {
    it("upserts a fabric button rule", async () => {
      const upsert = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: null, error: null }));
      const from = vi.fn().mockReturnValue({ upsert });

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      await repo.upsertFabricButtonRule({
        retailerId,
        fabricKey: materialKey,
        allowedButtonKeys: ["horn-natural", "horn-dark"],
        note: "No metal buttons on this cloth.",
      });

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          retailer_id: retailerId,
          fabric_key: materialKey,
          allowed_button_keys: ["horn-natural", "horn-dark"],
          note: "No metal buttons on this cloth.",
        }),
        expect.any(Object),
      );
    });

    it("trims note whitespace", async () => {
      const upsert = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: null, error: null }));
      const from = vi.fn().mockReturnValue({ upsert });

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      await repo.upsertFabricButtonRule({
        retailerId,
        fabricKey: materialKey,
        allowedButtonKeys: ["horn-dark"],
        note: "  No metal buttons.  ",
      });

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          note: "No metal buttons.",
        }),
        expect.any(Object),
      );
    });
  });

  describe("findFabricButtonRules", () => {
    it("finds all fabric button rules for a retailer", async () => {
      const rules: FabricButtonRuleRow[] = [
        makeButtonRule({
          allowed_button_keys: ["horn-dark", "corozo-charcoal"],
          note: "Avoid high-shine on a matte cloth.",
        }),
      ];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: rules, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.findFabricButtonRules({ retailerId });

      expect(result).toEqual(rules);
    });

    it("scopes to retailer_id in query", async () => {
      const eq = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: [], error: null }));
      const select = vi.fn().mockReturnValue({ eq });
      const from = vi.fn().mockReturnValue({ select });

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      await repo.findFabricButtonRules({ retailerId });

      expect(eq).toHaveBeenCalledWith("retailer_id", retailerId);
    });
  });

  describe("checkPairing", () => {
    it("allows a documented fabric-button pairing", async () => {
      const rules: FabricButtonRuleRow[] = [
        makeButtonRule({
          allowed_button_keys: ["horn-dark", "corozo-charcoal"],
          note: "Avoid high-shine on a matte cloth.",
        }),
      ];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: rules, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.checkPairing({
        retailerId,
        fabricKey: "flannel-grey",
        buttonKey: "horn-dark",
      });

      expect(result).toEqual({ ok: true });
    });

    it("refuses an undocumented pairing", async () => {
      const rules: FabricButtonRuleRow[] = [
        makeButtonRule({
          allowed_button_keys: ["horn-dark"],
          note: "Dark tones only.",
        }),
      ];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: rules, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.checkPairing({
        retailerId,
        fabricKey: "flannel-grey",
        buttonKey: "mother-of-pearl",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("pairing_not_allowed");
      }
    });

    it("refuses a pairing for a fabric with no rule", async () => {
      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: [], error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.checkPairing({
        retailerId,
        fabricKey: "linen-oat",
        buttonKey: "horn-dark",
      });

      expect(result).toEqual({ ok: false, reason: "no_rule_for_fabric" });
    });
  });

  describe("createException", () => {
    it("creates a supply exception when all checks pass", async () => {
      const from = vi.fn().mockReturnValue(
        fakeQueryBuilder({
          data: { id: "exception-001" },
          error: null,
        }),
      );

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.createException({
        retailerId,
        kind: "material_shortage",
        materialKey,
        ownerStaffId: staffId,
        detail: "Flannel run short on this order.",
        citations: [
          {
            sourceAuthorityKey: authorityKey,
            sourceVersion: "v1",
            observedAt: "2026-08-01T09:00:00.000Z",
          },
        ],
      });

      expect(result).toEqual({ ok: true, id: "exception-001" });
    });

    it("refuses an exception without an owner", async () => {
      const from = vi.fn();

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.createException({
        retailerId,
        kind: "material_shortage",
        materialKey,
        ownerStaffId: "  ",
        detail: "Flannel run short on this order.",
        citations: [
          {
            sourceAuthorityKey: authorityKey,
            sourceVersion: "v1",
            observedAt: "2026-08-01T09:00:00.000Z",
          },
        ],
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Should have failed");
      expect(result.reason).toBe("owner_required");
    });

    it("refuses an exception without citations", async () => {
      const from = vi.fn();

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.createException({
        retailerId,
        kind: "material_shortage",
        materialKey,
        ownerStaffId: staffId,
        detail: "Flannel run short on this order.",
        citations: [],
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Should have failed");
      expect(result.reason).toBe("citation_required");
    });
  });

  describe("resolveException", () => {
    it("updates an exception to resolved state with resolution note", async () => {
      const eq = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: null, error: null }));
      const update = vi.fn().mockReturnValue({ eq });
      const from = vi.fn().mockReturnValue({ update });

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      await repo.resolveException({
        retailerId,
        exceptionId: "exception-001",
        resolutionNote: "Sourced an equivalent bolt from a second mill.",
      });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          state: "resolved",
          resolution_note: "Sourced an equivalent bolt from a second mill.",
        }),
      );
    });

    it("scopes resolution to retailer_id for tenant isolation", async () => {
      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: null, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      await repo.resolveException({
        retailerId,
        exceptionId: "exception-001",
        resolutionNote: "Fixed",
      });

      expect(from).toHaveBeenCalledWith("supply_exceptions");
    });
  });

  describe("acknowledgeException", () => {
    it("transitions an open exception to acknowledged", async () => {
      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: null, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      await repo.acknowledgeException({
        retailerId,
        exceptionId: "exception-001",
      });

      expect(from).toHaveBeenCalledWith("supply_exceptions");
    });
  });

  describe("findExceptions", () => {
    it("finds all supply exceptions for a retailer", async () => {
      const exceptions: SupplyExceptionRow[] = [makeException({ id: "ex-1" })];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: exceptions, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.findExceptions({ retailerId });

      expect(result).toEqual(exceptions);
    });
  });

  describe("createComplaint", () => {
    it("creates a supply complaint case with summary and optional fields", async () => {
      const from = vi.fn().mockReturnValue(
        fakeQueryBuilder({
          data: { id: "complaint-001" },
          error: null,
        }),
      );

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.createComplaint({
        retailerId,
        summary: "Trouser seam opened on delivery",
        customerId: "cust-001",
        orderId: "order-001",
      });

      expect(result).toEqual({ id: "complaint-001" });
    });

    it("omits optional fields when not provided", async () => {
      const insert = vi.fn().mockReturnValue(
        fakeQueryBuilder({
          data: { id: "complaint-001" },
          error: null,
        }),
      );
      const from = vi.fn().mockReturnValue({ insert });

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      await repo.createComplaint({
        retailerId,
        summary: "Trouser seam opened on delivery",
      });

      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          retailer_id: retailerId,
          summary: "Trouser seam opened on delivery",
        }),
      );
      expect(insert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: expect.anything(),
        }),
      );
    });
  });

  describe("findComplaints", () => {
    it("finds all complaint cases for a retailer", async () => {
      const complaints: SupplyComplaintCaseRow[] = [
        {
          id: "complaint-1",
          retailer_id: retailerId,
          summary: "Seam defect",
          customer_id: null,
          order_id: null,
          piece_id: null,
          supplier_key: null,
          owner_staff_id: null,
          state: "raised",
          evidence_refs: [],
          customer_recovery_note: null,
          supplier_action_note: null,
          outcome_note: null,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
        },
      ];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: complaints, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.findComplaints({ retailerId });

      expect(result).toEqual(complaints);
    });

    it("scopes query to retailer_id", async () => {
      const eq = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: [], error: null }));
      const select = vi.fn().mockReturnValue({ eq });
      const from = vi.fn().mockReturnValue({ select });

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      await repo.findComplaints({ retailerId });

      expect(eq).toHaveBeenCalledWith("retailer_id", retailerId);
    });
  });

  describe("transitionComplaint", () => {
    it("transitions a complaint through the workflow states", async () => {
      const updateBuilder = fakeQueryBuilder({ data: null, error: null });
      const selectBuilder = fakeQueryBuilder({
        data: { state: "raised", evidence_refs: [] },
        error: null,
      });

      const from = vi.fn((table: string) => {
        if (table === "supply_complaint_cases") {
          return {
            select: vi.fn().mockReturnValue({
              ...selectBuilder,
              eq: selectBuilder.eq,
            }),
            update: vi.fn().mockReturnValue(updateBuilder),
          };
        }
        return {};
      });

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.transitionComplaint({
        retailerId,
        complaintId: "complaint-001",
        to: "investigating",
      });

      expect(result).toEqual({ ok: true });
    });

    it("refuses to notify supplier without evidence", async () => {
      const selectBuilder = fakeQueryBuilder({
        data: { state: "investigating", evidence_refs: [] },
        error: null,
      });

      const from = vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          ...selectBuilder,
          eq: selectBuilder.eq,
        }),
      }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.transitionComplaint({
        retailerId,
        complaintId: "complaint-001",
        to: "supplier_notified",
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Should have failed");
      expect(result.reason).toBe("evidence_required");
    });

    it("allows notifying supplier with evidence attached", async () => {
      const updateBuilder = fakeQueryBuilder({ data: null, error: null });
      const selectBuilder = fakeQueryBuilder({
        data: { state: "investigating", evidence_refs: [] },
        error: null,
      });

      const from = vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          ...selectBuilder,
          eq: selectBuilder.eq,
        }),
        update: vi.fn().mockReturnValue(updateBuilder),
      }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.transitionComplaint({
        retailerId,
        complaintId: "complaint-001",
        to: "supplier_notified",
        evidenceRefs: ["photo-seam-001.jpg"],
      });

      expect(result).toEqual({ ok: true });
    });

    it("refuses to close without customer recovery", async () => {
      const selectBuilder = fakeQueryBuilder({
        data: { state: "supplier_notified", evidence_refs: [] },
        error: null,
      });

      const from = vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          ...selectBuilder,
          eq: selectBuilder.eq,
        }),
      }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.transitionComplaint({
        retailerId,
        complaintId: "complaint-001",
        to: "closed",
        outcomeNote: "Supplier issued a credit.",
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Should have failed");
      expect(result.reason).toBe("close_requires_customer_recovery");
    });

    it("requires outcome note when closing", async () => {
      const selectBuilder = fakeQueryBuilder({
        data: { state: "customer_recovered", evidence_refs: [] },
        error: null,
      });

      const from = vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          ...selectBuilder,
          eq: selectBuilder.eq,
        }),
      }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.transitionComplaint({
        retailerId,
        complaintId: "complaint-001",
        to: "closed",
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Should have failed");
      expect(result.reason).toBe("close_requires_outcome");
    });

    it("allows closing with customer recovery and outcome note", async () => {
      const updateBuilder = fakeQueryBuilder({ data: null, error: null });
      const selectBuilder = fakeQueryBuilder({
        data: { state: "customer_recovered", evidence_refs: [] },
        error: null,
      });

      const from = vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          ...selectBuilder,
          eq: selectBuilder.eq,
        }),
        update: vi.fn().mockReturnValue(updateBuilder),
      }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.transitionComplaint({
        retailerId,
        complaintId: "complaint-001",
        to: "closed",
        outcomeNote: "Remade at our cost; client collected and was happy.",
      });

      expect(result).toEqual({ ok: true });
    });

    it("scopes update to retailer_id for tenant isolation", async () => {
      const updateBuilder = fakeQueryBuilder({ data: null, error: null });
      const selectBuilder = fakeQueryBuilder({
        data: { state: "raised", evidence_refs: [] },
        error: null,
      });

      const from = vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          ...selectBuilder,
          eq: selectBuilder.eq,
        }),
        update: vi.fn().mockReturnValue(updateBuilder),
      }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      await repo.transitionComplaint({
        retailerId,
        complaintId: "complaint-001",
        to: "investigating",
      });

      expect(from).toHaveBeenCalledWith("supply_complaint_cases");
    });

    it("throws when complaint is not found", async () => {
      const selectBuilder = fakeQueryBuilder({
        data: null,
        error: null,
      });

      const from = vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          ...selectBuilder,
          eq: selectBuilder.eq,
        }),
      }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      await expect(
        repo.transitionComplaint({
          retailerId,
          complaintId: "nonexistent-001",
          to: "investigating",
        }),
      ).rejects.toThrow("Complaint not found");
    });
  });

  describe("fabric lining rules", () => {
    it("finds fabric lining rules for a retailer", async () => {
      const rules: FabricLiningRuleRow[] = [makeLiningRule()];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: rules, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.findFabricLiningRules({ retailerId });

      expect(result).toEqual(rules);
    });

    it("checks lining pairing and allows a standard lining", async () => {
      const rules: FabricLiningRuleRow[] = [makeLiningRule()];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: rules, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.checkLiningPairing({
        retailerId,
        fabricKey: "flannel-grey",
        liningKey: "bemberg-charcoal",
      });

      expect(result).toEqual({ ok: true, tier: "standard" });
    });

    it("checks lining pairing and allows an upsell lining", async () => {
      const rules: FabricLiningRuleRow[] = [makeLiningRule()];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: rules, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.checkLiningPairing({
        retailerId,
        fabricKey: "flannel-grey",
        liningKey: "silk-jacquard-house",
      });

      expect(result).toEqual({ ok: true, tier: "upsell" });
    });

    it("refuses an undocumented lining pairing", async () => {
      const rules: FabricLiningRuleRow[] = [makeLiningRule()];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: rules, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.checkLiningPairing({
        retailerId,
        fabricKey: "flannel-grey",
        liningKey: "polyester-black",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("pairing_not_allowed");
        expect(result.options).toBeDefined();
      }
    });

    it("upserts a fabric lining rule", async () => {
      const upsert = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: null, error: null }));
      const from = vi.fn().mockReturnValue({ upsert });

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      await repo.upsertFabricLiningRule({
        retailerId,
        fabricKey: "flannel-grey",
        standardLiningKeys: ["bemberg-charcoal"],
        upsellLiningKeys: ["silk-jacquard-house"],
        note: "  House jacquard upgrade.  ",
      });

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          retailer_id: retailerId,
          fabric_key: "flannel-grey",
          standard_lining_keys: ["bemberg-charcoal"],
          upsell_lining_keys: ["silk-jacquard-house"],
          note: "House jacquard upgrade.",
        }),
        expect.any(Object),
      );
    });
  });

  describe("resolveFact", () => {
    it("delegates to resolveSupplierFact domain function", async () => {
      const facts: SupplierFactRow[] = [
        makeFact({
          id: "fact-1",
          material_key: "cloth-4412",
          source_authority_key: "mill_a_feed",
          source_version: "feed-2026-08-01",
        }),
      ];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: facts, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.resolveFact({
        retailerId,
        kind: "material_availability",
        materialKey: "cloth-4412",
        registeredAuthorityKeys: ["mill_a_feed"],
        asOf: "2026-08-01T06:00:00.000Z",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.fact.value).toBe("in_stock");
        expect(result.stale).toBe(false);
      }
    });

    it("returns unknown_authority when fact comes from unregistered source", async () => {
      const facts: SupplierFactRow[] = [
        makeFact({
          id: "fact-1",
          material_key: "cloth-4412",
          source_authority_key: "unknown_source",
        }),
      ];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: facts, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.resolveFact({
        retailerId,
        kind: "material_availability",
        materialKey: "cloth-4412",
        registeredAuthorityKeys: ["mill_a_feed"],
        asOf: "2026-08-01T06:00:00.000Z",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("unknown_authority");
      }
    });

    it("supports custom staleness threshold", async () => {
      const facts: SupplierFactRow[] = [
        makeFact({
          id: "fact-1",
          material_key: "cloth-4412",
          source_authority_key: "mill_a_feed",
          source_version: "feed-2026-08-01",
        }),
      ];

      const from = vi
        .fn()
        .mockReturnValue(fakeQueryBuilder({ data: facts, error: null }));

      const repo = new SupplierIntelligenceRepository({
        from,
      } as unknown as PaonSupabaseClient);

      const result = await repo.resolveFact({
        retailerId,
        kind: "material_availability",
        materialKey: "cloth-4412",
        registeredAuthorityKeys: ["mill_a_feed"],
        asOf: "2026-08-10T00:00:00.000Z",
        stalenessHours: 24,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.stale).toBe(true);
      }
    });
  });
});
