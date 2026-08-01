/**
 * REAL integration tests. These hit a live Postgres, execute real SQL,
 * and force real CHECK constraints and unique indexes to throw.
 *
 * Why this file exists
 * --------------------
 * The `*-security.test.ts` files in the parent directory read migration
 * `.sql` files as TEXT and assert they contain a constraint string. That
 * proves the migration SAYS the right thing. It does not prove a single
 * constraint ever fires, and it was wrong of me to present it as
 * verification. Those files stay as a cheap guard against someone deleting
 * a constraint from a migration, but they are NOT proof and must never
 * again be counted as such.
 *
 * This file is the proof. Every assertion below either writes a row that
 * Postgres must accept, or writes one Postgres must reject with a specific
 * SQLSTATE.
 *
 * Skipped unless PAON_INTEGRATION=1 so the ordinary unit gate stays
 * hermetic and offline. Run with:
 *   PAON_INTEGRATION=1 pnpm --filter @paon/database exec vitest run src/repositories/__integration__
 */

import type { RetailerId } from "@paon/domain";
import { beforeAll, describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../../client-type";
import { createSupabaseAdminClient } from "../../clients/admin";
import { CoachingRepository } from "../coaching-repository";
import { CoveragePlanningRepository } from "../coverage-planning-repository";
import { InternalCommunityRepository } from "../internal-community-repository";
import { MeasurementMonitorRepository } from "../measurement-monitor-repository";

const LIVE = process.env["PAON_INTEGRATION"] === "1";

/** Postgres SQLSTATEs we deliberately provoke. */
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

let admin: PaonSupabaseClient;
let retailerId: RetailerId;
let staffA: string;
let staffB: string;
let customerId: string;

/** Unique per run so repeated runs never collide on natural keys. */
const RUN = Date.now();

describe.skipIf(!LIVE)("live database integration (stages 11-12)", () => {
  beforeAll(async () => {
    const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) throw new Error("Live integration needs Supabase env.");
    admin = createSupabaseAdminClient(url, key);

    const { data: retailer } = await admin
      .from("retailers")
      .select("id")
      .limit(1)
      .single();
    retailerId = retailer!.id as RetailerId;

    const { data: staff } = await admin
      .from("retailer_staff_members")
      .select("id")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .limit(2);
    staffA = staff![0]!.id;
    // A second person is required by every separation-of-duties rule under
    // test. Create one rather than skipping those assertions.
    if (staff!.length > 1) {
      staffB = staff![1]!.id;
    } else {
      const { data: extra } = await admin
        .from("retailer_staff_members")
        .insert({
          retailer_id: retailerId,
          full_name: `Integration Colleague ${RUN}`,
          role: "sales_associate",
          email: `integration-${RUN}@example.com`,
        })
        .select("id")
        .single();
      staffB = extra!.id;
    }

    const { data: customer } = await admin
      .from("customers")
      .select("id")
      .eq("retailer_id", retailerId)
      .limit(1)
      .single();
    customerId = customer!.id;
  });

  // ---------------------------------------------------- 11.3 coverage

  describe("coverage_plans", () => {
    it("REJECTS a duplicate whole-retailer plan for one date", async () => {
      // The defect fixed in 20260801000015. branch_id is nullable, and
      // Postgres treats NULLs as distinct in a UNIQUE constraint unless
      // NULLS NOT DISTINCT is declared. Before the fix this inserted twice.
      const planDate = `2029-01-${String((RUN % 27) + 1).padStart(2, "0")}`;
      await admin
        .from("coverage_plans")
        .delete()
        .eq("retailer_id", retailerId)
        .eq("plan_date", planDate);

      const row = {
        retailer_id: retailerId,
        plan_date: planDate,
        timezone: "Europe/Amsterdam",
        state: "draft" as const,
      };
      const first = await admin.from("coverage_plans").insert(row);
      expect(first.error).toBeNull();

      const second = await admin.from("coverage_plans").insert(row);
      expect(second.error?.code).toBe(UNIQUE_VIOLATION);

      await admin
        .from("coverage_plans")
        .delete()
        .eq("retailer_id", retailerId)
        .eq("plan_date", planDate);
    });

    it("REJECTS a plan claiming published state with no publisher", async () => {
      const planDate = `2029-02-${String((RUN % 27) + 1).padStart(2, "0")}`;
      const bad = await admin.from("coverage_plans").insert({
        retailer_id: retailerId,
        plan_date: planDate,
        timezone: "Europe/Amsterdam",
        state: "published",
      });
      expect(bad.error?.code).toBe(CHECK_VIOLATION);
    });

    it("re-saving a published plan reverts it to draft without violating the constraint", async () => {
      // This is the second defect the 11.3 UI found: saveDraftPlan must
      // clear published_at / published_by_staff_id, or the upsert dies
      // with 23514. Exercised through the repository, not raw SQL.
      const planDate = `2029-03-${String((RUN % 27) + 1).padStart(2, "0")}`;
      await admin
        .from("coverage_plans")
        .delete()
        .eq("retailer_id", retailerId)
        .eq("plan_date", planDate);

      const repo = new CoveragePlanningRepository(admin);
      const first = await repo.saveDraftPlan({
        retailerId,
        planDate,
        timezone: "Europe/Amsterdam",
        intervals: [
          { startTime: "10:00", endTime: "14:00", requiredHeadcount: 2 },
        ],
      });
      await repo.publishPlan({
        retailerId,
        planId: first.id,
        publishedByStaffId: staffA,
      });

      const second = await repo.saveDraftPlan({
        retailerId,
        planDate,
        timezone: "Europe/Amsterdam",
        intervals: [
          { startTime: "14:00", endTime: "18:00", requiredHeadcount: 3 },
        ],
      });
      expect(second.id).toBe(first.id);
      expect(second.intervals).toHaveLength(1);
      // Intervals are REPLACED, not merged.
      expect(second.intervals[0]?.startTime).toBe("14:00");

      const { data: rows } = await admin
        .from("coverage_plans")
        .select("id")
        .eq("retailer_id", retailerId)
        .eq("plan_date", planDate);
      expect(rows?.length).toBe(1);

      await admin
        .from("coverage_plans")
        .delete()
        .eq("retailer_id", retailerId)
        .eq("plan_date", planDate);
    });
  });

  // ---------------------------------------------------- 11.3 coaching

  describe("staff_coaching_observations", () => {
    it("REJECTS an observation someone recorded about themselves", async () => {
      const bad = await admin.from("staff_coaching_observations").insert({
        retailer_id: retailerId,
        observed_staff_id: staffA,
        observer_staff_id: staffA,
        observed_on: "2029-01-01",
        scores: [],
        state: "observed",
      });
      expect(bad.error?.code).toBe(CHECK_VIOLATION);
    });

    it("REJECTS a closed loop with no outcome recorded", async () => {
      const bad = await admin.from("staff_coaching_observations").insert({
        retailer_id: retailerId,
        observed_staff_id: staffB,
        observer_staff_id: staffA,
        observed_on: "2029-01-01",
        scores: [],
        state: "outcome_recorded",
        agreed_action: "Something",
      });
      expect(bad.error?.code).toBe(CHECK_VIOLATION);
    });

    it("walks the real loop through the repository one step at a time", async () => {
      const repo = new CoachingRepository(admin);
      const created = await repo.recordObservation({
        retailerId,
        observedStaffId: staffB,
        observerStaffId: staffA,
        observedOn: "2029-01-02",
        scores: [
          {
            criterionKey: "discovery",
            score: 3,
            evidence: "Asked about the occasion before showing cloth.",
          },
        ],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      // Skipping a step must be refused by the domain layer.
      const skipped = await repo.advanceLoop({
        retailerId,
        observationId: created.id,
        next: "outcome_recorded",
        outcomeNote: "Jumped ahead",
      });
      expect(skipped.ok).toBe(false);

      expect(
        (
          await repo.advanceLoop({
            retailerId,
            observationId: created.id,
            next: "discussed",
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await repo.advanceLoop({
            retailerId,
            observationId: created.id,
            next: "plan_agreed",
            agreedAction: "Offer the loan garment on long alterations.",
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await repo.advanceLoop({
            retailerId,
            observationId: created.id,
            next: "outcome_recorded",
            outcomeNote: "Did it unprompted twice.",
          })
        ).ok,
      ).toBe(true);

      await admin
        .from("staff_coaching_observations")
        .delete()
        .eq("id", created.id);
    });

    it("publishes ceremony versions monotonically and never edits a published one", async () => {
      const repo = new CoachingRepository(admin);
      const key = `integration_ceremony_${RUN}`;
      const first = await repo.publishCeremony({
        retailerId,
        ceremonyKey: key,
        steps: [{ key: "greet", title: "Greet", guidance: "By name." }],
      });
      expect(first.ok).toBe(true);
      const second = await repo.publishCeremony({
        retailerId,
        ceremonyKey: key,
        steps: [{ key: "greet", title: "Greet", guidance: "By name, warmly." }],
      });
      expect(second.ok).toBe(true);
      if (first.ok && second.ok) expect(second.version).toBe(first.version + 1);

      // The unique index must refuse a hand-rolled duplicate version.
      const dup = await admin.from("service_ceremony_versions").insert({
        retailer_id: retailerId,
        ceremony_key: key,
        version: 1,
        published: true,
        published_at: new Date().toISOString(),
        steps: [],
      });
      expect(dup.error?.code).toBe(UNIQUE_VIOLATION);

      await admin
        .from("service_ceremony_versions")
        .delete()
        .eq("retailer_id", retailerId)
        .eq("ceremony_key", key);
    });
  });

  // ------------------------------------------------- 11.4 community

  describe("internal community", () => {
    it("records one read receipt per person no matter how many times it is sent", async () => {
      const repo = new InternalCommunityRepository(admin);
      const published = await repo.publishAnnouncement({
        retailerId,
        authoredByStaffId: staffA,
        title: `Integration notice ${RUN}`,
        body: "The fire door code changed this morning.",
        requiresAcknowledgement: true,
      });

      await repo.acknowledgeAnnouncement({
        retailerId,
        announcementId: published.id,
        staffId: staffB,
      });
      await repo.acknowledgeAnnouncement({
        retailerId,
        announcementId: published.id,
        staffId: staffB,
      });

      const { data: acks } = await admin
        .from("staff_announcement_acknowledgements")
        .select("id")
        .eq("announcement_id", published.id);
      expect(acks?.length).toBe(1);

      await admin.from("staff_announcements").delete().eq("id", published.id);
    });

    it("REJECTS a self-approved service-recovery budget", async () => {
      const bad = await admin.from("service_recovery_budget_requests").insert({
        retailer_id: retailerId,
        requested_by_staff_id: staffA,
        approved_by_staff_id: staffA,
        decided_at: new Date().toISOString(),
        customer_id: customerId,
        amount_minor_units: 5000,
        reason: "Re-press and courier a creased jacket.",
        state: "approved",
      });
      expect(bad.error?.code).toBe(CHECK_VIOLATION);
    });

    it("REJECTS a budget request attached to neither customer nor order", async () => {
      const bad = await admin.from("service_recovery_budget_requests").insert({
        retailer_id: retailerId,
        requested_by_staff_id: staffA,
        amount_minor_units: 5000,
        reason: "Unattached petty cash by another name.",
      });
      expect(bad.error?.code).toBe(CHECK_VIOLATION);
    });

    it("REJECTS a rejected contribution carrying no reason", async () => {
      const bad = await admin.from("staff_learning_contributions").insert({
        retailer_id: retailerId,
        author_staff_id: staffA,
        title: `Integration lesson ${RUN}`,
        body: "A body long enough to clear the forty character minimum floor.",
        state: "rejected",
        moderated_by_staff_id: staffB,
        moderated_at: new Date().toISOString(),
      });
      expect(bad.error?.code).toBe(CHECK_VIOLATION);
    });

    it("REJECTS a self-moderated contribution", async () => {
      const bad = await admin.from("staff_learning_contributions").insert({
        retailer_id: retailerId,
        author_staff_id: staffA,
        title: `Integration lesson self ${RUN}`,
        body: "A body long enough to clear the forty character minimum floor.",
        state: "approved",
        moderated_by_staff_id: staffA,
        moderated_at: new Date().toISOString(),
      });
      expect(bad.error?.code).toBe(CHECK_VIOLATION);
    });
  });

  // ------------------------------------------------ 12.1 measurements

  describe("customer_measurement_versions", () => {
    it("REFUSES any UPDATE, because a correction must be a new version", async () => {
      const repo = new MeasurementMonitorRepository(admin);
      const created = await repo.recordApprovedVersion({
        retailerId,
        customerId,
        values: [
          { key: "chest", millimetres: 1020, capturedBy: "tailor_tape" },
        ],
        approvedByStaffId: staffA,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      // The table has no UPDATE grant on any role. Even service_role must
      // be refused — that is the entire "never silently overwrite approved
      // measurements" guarantee, and it has never been tested until now.
      const attempt = await admin
        .from("customer_measurement_versions")
        .update({ approved_by_staff_id: staffB })
        .eq("id", created.id)
        .select("id");
      const changedNothing =
        attempt.error !== null || (attempt.data?.length ?? 0) === 0;
      expect(changedNothing).toBe(true);
    });

    it("REJECTS a second version reusing a version number", async () => {
      const { data: latest } = await admin
        .from("customer_measurement_versions")
        .select("version")
        .eq("customer_id", customerId)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const bad = await admin.from("customer_measurement_versions").insert({
        retailer_id: retailerId,
        customer_id: customerId,
        version: latest!.version,
        values: [{ key: "chest", millimetres: 999, capturedBy: "tailor_tape" }],
        approved_by_staff_id: staffA,
      });
      expect(bad.error?.code).toBe(UNIQUE_VIOLATION);
    });

    it("REJECTS a failed-quality candidate that claims a comparison decision", async () => {
      const bad = await admin.from("customer_measurement_candidates").insert({
        retailer_id: retailerId,
        customer_id: customerId,
        values: [],
        quality_passed: false,
        decision: "no_action",
        decision_version: 1,
        rationale: "Quality failed but claiming no action.",
      });
      expect(bad.error?.code).toBe(CHECK_VIOLATION);
    });

    it("blocks a reorder while an advisor review is open, then allows it once resolved", async () => {
      const repo = new MeasurementMonitorRepository(admin);
      const candidate = await repo.recordCandidate({
        retailerId,
        customerId,
        values: [
          { key: "chest", millimetres: 1080, capturedBy: "guided_self_scan" },
        ],
        qualitySignals: {
          captureCount: 3,
          poseConfidence: 0.95,
          landmarksDetected: 18,
          landmarksExpected: 18,
          hasScaleReference: true,
        },
      });
      expect(candidate.result.decision).toBe("advisor_review");

      const blocked = await repo.checkReorderAllowed({ customerId });
      expect(blocked).toEqual({
        allowed: false,
        reason: "open_advisor_review",
      });

      await repo.resolveCandidate({
        retailerId,
        candidateId: candidate.id,
        resolvedByStaffId: staffA,
      });

      const afterResolve = await repo.checkReorderAllowed({ customerId });
      expect(afterResolve.allowed).toBe(true);

      await admin
        .from("customer_measurement_candidates")
        .delete()
        .eq("id", candidate.id);
    });
  });
});
