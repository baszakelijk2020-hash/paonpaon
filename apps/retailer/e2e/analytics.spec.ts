import {
  AppointmentRepository,
  CustomerRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "14.2";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/analytics.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

test("a sparse temporal hotspot is labelled insufficient, then crossing the sample floor labels it supported", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = asId<"RetailerId">(retailer.id);

  const unique = Date.now();
  const customer = await new CustomerRepository(admin).create({
    retailerId,
    fullName: `E2E Analytics Client ${unique}`,
    email: `analytics-${unique}@paon.test`,
    lifecycleStage: "prospect",
  });

  // `findBusiestSlot` buckets by UTC day-of-week + hour (168 combinations)
  // across a 90-day rolling window (`computeTemporalHotspot`), not by exact
  // date. Varying the bucket by `unique` only lowers collision odds — with
  // enough same-day runs against this long-lived shared fixture retailer,
  // the birthday paradox still lands two runs in the same bucket (observed
  // directly: a run's freshly-seeded 3-appointment bucket read back as
  // "indicative" because of stray rows left by earlier runs). The only
  // deterministic fix is to clear the chosen bucket of any pre-existing,
  // non-cancelled appointments before seeding, regardless of which run or
  // spec left them there.
  const baseDate = new Date();
  baseDate.setUTCDate(baseDate.getUTCDate() - 30 - (unique % 7));
  baseDate.setUTCHours(unique % 24, 0, 0, 0);
  const bucketDayOfWeek = baseDate.getUTCDay();
  const bucketHour = baseDate.getUTCHours();

  const appointmentRepo = new AppointmentRepository(admin);
  const appointmentIds: string[] = [];

  {
    const windowFrom = new Date(
      baseDate.getTime() - 90 * 86_400_000,
    ).toISOString();
    const windowTo = new Date().toISOString();
    const { data: candidates } = await admin
      .from("appointments")
      .select("id, starts_at")
      .eq("retailer_id", retailerId)
      .neq("status", "canceled")
      .neq("status", "no_show")
      .gte("starts_at", windowFrom)
      .lte("starts_at", windowTo);
    const staleIds = (candidates ?? [])
      .filter((row) => {
        const d = new Date(row.starts_at);
        return (
          d.getUTCDay() === bucketDayOfWeek && d.getUTCHours() === bucketHour
        );
      })
      .map((row) => row.id);
    if (staleIds.length > 0) {
      await admin.from("appointments").delete().in("id", staleIds);
    }
  }

  async function seedAppointments(count: number): Promise<void> {
    for (let i = appointmentIds.length; i < count; i++) {
      const startsAt = new Date(baseDate.getTime() + i * 60_000);
      const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
      const appointment = await appointmentRepo.create({
        retailerId,
        customerId: customer.id,
        type: "fitting",
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
      appointmentIds.push(appointment.id);
    }
  }

  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
    await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Enter the atelier" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // ---- Sparse: three appointments in the bucket -> insufficient_sample --
    await seedAppointments(3);
    await page.goto("/analytics");
    await page
      .locator('[data-cited-insights="temporal_hotspot"]')
      .getByRole("button", { name: "Recompute" })
      .click();
    await expect(
      page.getByText("Recomputed from the latest appointments."),
    ).toBeVisible({
      timeout: 15_000,
    });

    const topInsight = page
      .locator('[data-cited-insights="temporal_hotspot"] [data-cited-insight]')
      .first();
    await expect(topInsight).toBeVisible({ timeout: 15_000 });
    await expect(topInsight).toHaveAttribute(
      "data-confidence",
      "insufficient_sample",
    );
    await expect(topInsight.getByText("Insufficient sample")).toBeVisible();
    await expect(topInsight.getByText("n=3")).toBeVisible();

    const { data: sparseRows } = await admin
      .from("cited_recommendations")
      .select("id, withdrawn_at")
      .eq("retailer_id", retailerId)
      .eq("kind", "temporal_hotspot")
      .is("withdrawn_at", null);
    expect(sparseRows).toHaveLength(1);

    // ---- Crossing the supported floor (50) supersedes the sparse row ------
    await seedAppointments(50);
    await page.goto("/analytics");
    await page
      .locator('[data-cited-insights="temporal_hotspot"]')
      .getByRole("button", { name: "Recompute" })
      .click();
    await expect(
      page.getByText("Recomputed from the latest appointments."),
    ).toBeVisible({
      timeout: 15_000,
    });

    const supportedInsight = page
      .locator('[data-cited-insights="temporal_hotspot"] [data-cited-insight]')
      .first();
    await expect(supportedInsight).toBeVisible({ timeout: 15_000 });
    await expect(supportedInsight).toHaveAttribute(
      "data-confidence",
      "supported",
    );
    await expect(supportedInsight.getByText("Supported")).toBeVisible();
    await expect(supportedInsight.getByText("n=50")).toBeVisible();

    // Superseded, not accumulated: exactly one live temporal_hotspot row.
    const { data: liveRows } = await admin
      .from("cited_recommendations")
      .select("id, withdrawn_at")
      .eq("retailer_id", retailerId)
      .eq("kind", "temporal_hotspot")
      .is("withdrawn_at", null);
    expect(liveRows).toHaveLength(1);
    expect(liveRows?.[0]?.id).not.toBe(sparseRows?.[0]?.id);

    const { data: withdrawnRows } = await admin
      .from("cited_recommendations")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("kind", "temporal_hotspot")
      .not("withdrawn_at", "is", null)
      .eq("id", sparseRows?.[0]?.id ?? "");
    expect(withdrawnRows).toHaveLength(1);

    proofPassed = true;
  } finally {
    if (appointmentIds.length > 0) {
      await admin
        .from("cited_recommendations")
        .delete()
        .eq("retailer_id", retailerId)
        .eq("kind", "temporal_hotspot")
        .overlaps("derived_from_fact_ids", appointmentIds);
      await admin.from("appointments").delete().in("id", appointmentIds);
    }
    await admin.from("customers").delete().eq("id", customer.id);
  }
});
