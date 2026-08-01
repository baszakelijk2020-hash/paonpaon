/**
 * Live proof for loss prevention and the RFID pilot (PHASE 13.2).
 *
 * The two rules worth proving against a real database:
 *
 * 1. **Separation of duties.** A flagged adjustment does not move stock when
 *    it is raised, a peer cannot approve it, the requester cannot approve
 *    their own, and only a different manager's approval writes the ledger
 *    entry.
 * 2. **A sweep never posts a balance.** Repeated reads of one tag collapse to
 *    one garment, a tag nobody read is `unobserved` rather than `missing`,
 *    low-confidence reads stay visible, and no ledger entry appears anywhere.
 *
 * Run with:
 *   PAON_INTEGRATION=1 pnpm --filter @paon/database exec vitest run \
 *     src/repositories/__integration__
 */

import type { RetailerId } from "@paon/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../../client-type";
import { createSupabaseAdminClient } from "../../clients/admin";
import { LossPreventionRepository } from "../loss-prevention-repository";
import { StockLedgerRepository } from "../stock-ledger-repository";

const LIVE = process.env["PAON_INTEGRATION"] === "1";
const CHECK_VIOLATION = "23514";
const RUN = Date.now();

let admin: PaonSupabaseClient;
let risk: LossPreventionRepository;
let ledger: StockLedgerRepository;
let retailerId: RetailerId;
let variantId: string;
let requesterId: string;
let managerId: string;

/**
 * Locations this suite created. An unapproved risk flag is NOT inert: it sits
 * in the retailer's approval queue forever and makes the write-offs page
 * non-empty, which fails unrelated specs later and looks like their bug. The
 * suite that created them removes them.
 */
const createdLocationIds: string[] = [];

async function freshLocation(tag: string): Promise<string> {
  const { id } = await ledger.ensureLocation({
    retailerId,
    code: `LP-${tag}-${RUN}`,
    name: `LP ${tag} ${RUN}`,
  });
  createdLocationIds.push(id);
  return id;
}

describe.skipIf(!LIVE)("loss prevention, live (13.2)", () => {
  beforeAll(async () => {
    const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) throw new Error("Live integration needs Supabase env.");
    admin = createSupabaseAdminClient(url, key);
    risk = new LossPreventionRepository(admin);
    ledger = new StockLedgerRepository(admin);

    const { data: retailer } = await admin
      .from("retailers")
      .select("id")
      .limit(1)
      .single();
    retailerId = retailer!.id as RetailerId;

    // Two different people. Separation of duties cannot be tested with one.
    const { data: staff } = await admin
      .from("retailer_staff_members")
      .select("id, role")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .limit(10);
    expect(staff?.length ?? 0).toBeGreaterThanOrEqual(2);
    requesterId = staff![0]!.id;
    managerId = staff![1]!.id;

    const { data: variant } = await admin
      .from("product_variants")
      .select("id")
      .limit(1)
      .single();
    variantId = variant!.id;
  });

  afterAll(async () => {
    if (createdLocationIds.length === 0) return;
    // The FLAGS are removed, not the locations. `stock_ledger_entries` has no
    // cascade from `stock_locations` on purpose — an append-only ledger must
    // not become deletable by removing a shelf — so the location stays and
    // only the approval queue is tidied.
    await admin
      .from("stock_risk_flags")
      .delete()
      .in("location_id", createdLocationIds);
  });

  it("a high-value adjustment is flagged, and the flag alone moves no stock", async () => {
    const locationId = await freshLocation("FLAG");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 10 });

    const assessment = await risk.assess({
      retailerId,
      variantId,
      // €900 written off in one go.
      unitPriceMinorUnits: 30_000,
      adjustmentQuantity: -3,
      withinCountSession: true,
    });
    expect(assessment.requiresIndependentApproval).toBe(true);
    expect(assessment.triggered).toContain("high_value_adjustment");

    const flag = await risk.requestApproval({
      retailerId,
      locationId,
      requestedByStaffId: requesterId,
      triggeredRules: assessment.triggered,
    });

    // Raised, not applied. This is the distinction the whole control rests
    // on: an unapproved write-off must not be indistinguishable from a
    // completed one.
    const row = await risk.findFlag({ retailerId, flagId: flag.id });
    expect(row!.approved_at).toBeNull();
    expect(row!.ledger_entry_id).toBeNull();

    const balance = await ledger.balanceFor({
      retailerId,
      variantId,
      locationId,
    });
    expect(balance.onHand).toBe(10);
  });

  it("REFUSES self-approval, in the application and in the database", async () => {
    const locationId = await freshLocation("SELF");
    const flag = await risk.requestApproval({
      retailerId,
      locationId,
      requestedByStaffId: requesterId,
      triggeredRules: ["high_value_adjustment"],
    });

    const attempt = await risk.approveAndApply({
      retailerId,
      flagId: flag.id,
      approverStaffId: requesterId,
      approverIsManager: true,
      sessionId: "00000000-0000-0000-0000-000000000000",
      variantId,
      locationId,
      adjustmentQuantity: -1,
      reason: "Trying to approve my own write-off.",
    });
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.reason).toBe("self_approval_not_allowed");

    // And the constraint holds even if something bypasses the repository —
    // the same manager signing their own adjustment is not a second pair of
    // eyes, so it is refused by the schema rather than by convention.
    const direct = await admin
      .from("stock_risk_flags")
      .update({
        approved_by_staff_id: requesterId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", flag.id);
    expect(direct.error?.code).toBe(CHECK_VIOLATION);
  });

  it("REFUSES a peer who is not a manager", async () => {
    const locationId = await freshLocation("PEER");
    const flag = await risk.requestApproval({
      retailerId,
      locationId,
      requestedByStaffId: requesterId,
      triggeredRules: ["high_value_adjustment"],
    });

    const attempt = await risk.approveAndApply({
      retailerId,
      flagId: flag.id,
      approverStaffId: managerId,
      // A different person, but without authority. Either half alone is
      // insufficient: a peer approving a peer is not independence.
      approverIsManager: false,
      sessionId: "00000000-0000-0000-0000-000000000000",
      variantId,
      locationId,
      adjustmentQuantity: -1,
      reason: "A colleague waving it through.",
    });
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.reason).toBe("approver_lacks_authority");

    const row = await risk.findFlag({ retailerId, flagId: flag.id });
    expect(row!.approved_at).toBeNull();
  });

  it("a different manager's approval is what writes the ledger entry", async () => {
    const locationId = await freshLocation("APPROVE");
    // 20 not 3: a 1-of-3 shortfall is a 33% variance and trips the recount
    // threshold, which would make this test exercise the recount gate while
    // claiming to exercise approval. 19-of-20 is 5%.
    await ledger.receive({ retailerId, variantId, locationId, quantity: 20 });

    const session = await ledger.openCountSession({
      retailerId,
      locationId,
      openedByStaffId: requesterId,
    });
    await ledger.recordCountLine({
      retailerId,
      sessionId: session.id,
      variantId,
      countedQuantity: 19,
    });

    const flag = await risk.requestApproval({
      retailerId,
      locationId,
      requestedByStaffId: requesterId,
      triggeredRules: ["high_value_adjustment"],
    });

    const approved = await risk.approveAndApply({
      retailerId,
      flagId: flag.id,
      approverStaffId: managerId,
      approverIsManager: true,
      sessionId: session.id,
      variantId,
      locationId,
      adjustmentQuantity: -1,
      reason: "One found damaged during the count and written off.",
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;

    // Now, and only now, the stock moves.
    const balance = await ledger.balanceFor({
      retailerId,
      variantId,
      locationId,
    });
    expect(balance.onHand).toBe(19);

    // The flag cites the entry it authorised, so an audit can walk from the
    // approval to the movement rather than inferring it from timestamps.
    const row = await risk.findFlag({ retailerId, flagId: flag.id });
    expect(row!.approved_by_staff_id).toBe(managerId);
    expect(row!.ledger_entry_id).toBe(approved.ledgerEntryId);

    // A second approval is refused: one signature authorises one movement.
    const again = await risk.approveAndApply({
      retailerId,
      flagId: flag.id,
      approverStaffId: managerId,
      approverIsManager: true,
      sessionId: session.id,
      variantId,
      locationId,
      adjustmentQuantity: -1,
      reason: "Trying to write off a second one on the same approval.",
    });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe("already_approved");
  });

  it("a sweep collapses repeated reads and posts NO balance", async () => {
    const locationId = await freshLocation("SWEEP");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 2 });
    const sweepId = crypto.randomUUID();
    const zoneKey = "floor";
    const now = new Date().toISOString();

    await risk.recordObservations({
      retailerId,
      locationId,
      sweepId,
      observations: [
        // The same jacket read four times as the reader passes it. Counting
        // four is how an RFID pilot invents a surplus on day one.
        { epc: "EPC-A", zoneKey, observedAt: now, readConfidence: 0.97 },
        { epc: "EPC-A", zoneKey, observedAt: now, readConfidence: 0.95 },
        { epc: "EPC-A", zoneKey, observedAt: now, readConfidence: 0.99 },
        { epc: "EPC-A", zoneKey, observedAt: now, readConfidence: 0.92 },
        // A second garment, read once.
        { epc: "EPC-B", zoneKey, observedAt: now, readConfidence: 0.88 },
        // A poor read, kept so a bad sweep looks bad.
        { epc: "EPC-C", zoneKey, observedAt: now, readConfidence: 0.41 },
        // Something on the wrong shelf.
        { epc: "EPC-Z", zoneKey, observedAt: now, readConfidence: 0.95 },
      ],
    });

    const reconciliation = await risk.reconcile({
      retailerId,
      locationId,
      sweepId,
      zoneKey,
      // EPC-D is expected and was never read.
      expectedEpcs: ["EPC-A", "EPC-B", "EPC-D"],
    });

    // Everything confidently seen, including the mis-shelved one: "present"
    // means the reader is sure the tag is in this zone, which is a different
    // question from whether it was supposed to be.
    expect(reconciliation.presentEpcs).toEqual(["EPC-A", "EPC-B", "EPC-Z"]);
    // Never "missing": a tag goes unread for a dozen mundane reasons, and
    // "missing" invites a write-off nobody counted.
    expect(reconciliation.unobservedEpcs).toEqual(["EPC-D"]);
    expect(reconciliation.unexpectedEpcs).toEqual(["EPC-Z"]);
    // The bad read is reported, not swallowed.
    expect(reconciliation.lowConfidenceReadCount).toBe(1);
    expect(reconciliation.postsBalanceChange).toBe(false);

    // The hard guarantee: the sweep wrote nothing to the ledger at all.
    const { data: entries } = await admin
      .from("stock_ledger_entries")
      .select("kind")
      .eq("location_id", locationId);
    expect(entries!.map((entry) => entry.kind)).toEqual(["receipt"]);

    const balance = await ledger.balanceFor({
      retailerId,
      variantId,
      locationId,
    });
    expect(balance.onHand).toBe(2);
  });

  it("a discrepancy cannot be closed without saying why", async () => {
    const locationId = await freshLocation("RESOLVE");
    const sweepId = crypto.randomUUID();
    const zoneKey = "floor";

    await risk.recordObservations({
      retailerId,
      locationId,
      sweepId,
      observations: [
        {
          epc: "EPC-Q",
          zoneKey,
          observedAt: new Date().toISOString(),
          readConfidence: 0.99,
        },
      ],
    });
    const reconciliation = await risk.reconcile({
      retailerId,
      locationId,
      sweepId,
      zoneKey,
      expectedEpcs: ["EPC-MISSING"],
    });
    await risk.recordDiscrepancies({
      retailerId,
      sweepId,
      reconciliation,
    });

    const open = await risk.openDiscrepancies({ retailerId, sweepId });
    expect(open.length).toBeGreaterThan(0);
    const discrepancyId = open[0]!.id;

    // "Resolved" with no explanation is indistinguishable from "ignored", and
    // a pilot judged on unexplained resolutions looks far better than it is.
    const bare = await risk.resolveDiscrepancy({
      retailerId,
      discrepancyId,
      resolutionNote: "ok",
    });
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.reason).toBe("resolution_note_required");

    const explained = await risk.resolveDiscrepancy({
      retailerId,
      discrepancyId,
      resolutionNote:
        "Tag was on a jacket in the fitting room, not on the floor when the reader passed.",
    });
    expect(explained.ok).toBe(true);

    // And closing it again is refused, because it is no longer open.
    const twice = await risk.resolveDiscrepancy({
      retailerId,
      discrepancyId,
      resolutionNote: "Closing it a second time for no reason.",
    });
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.reason).toBe("not_an_open_discrepancy");
  });

  it("re-running a sweep's reconciliation does not duplicate its discrepancies", async () => {
    const locationId = await freshLocation("IDEMPOTENT");
    const sweepId = crypto.randomUUID();
    const zoneKey = "floor";

    await risk.recordObservations({
      retailerId,
      locationId,
      sweepId,
      observations: [
        {
          epc: "EPC-DUP",
          zoneKey,
          observedAt: new Date().toISOString(),
          readConfidence: 0.99,
        },
      ],
    });
    const reconciliation = await risk.reconcile({
      retailerId,
      locationId,
      sweepId,
      zoneKey,
      expectedEpcs: ["EPC-GONE"],
    });

    await risk.recordDiscrepancies({ retailerId, sweepId, reconciliation });
    await risk.recordDiscrepancies({ retailerId, sweepId, reconciliation });

    // A reader that retries after dropping its connection must not double
    // the work a person has to read through.
    const { data: rows } = await admin
      .from("rfid_sweep_discrepancies")
      .select("id, epc, kind")
      .eq("sweep_id", sweepId);
    expect(rows).toHaveLength(2);
  });
});
